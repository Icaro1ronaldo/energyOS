resource "aws_ecs_cluster" "main" {
  name = "${var.project}-cluster"
  setting { name = "containerInsights"; value = "enabled" }
}

resource "aws_security_group" "ecs_tasks" {
  name   = "${var.project}-ecs-sg"
  vpc_id = aws_vpc.main.id
  ingress { from_port = 0; to_port = 65535; protocol = "tcp"; security_groups = [aws_security_group.alb.id] }
  egress  { from_port = 0; to_port = 0;     protocol = "-1";  cidr_blocks = ["0.0.0.0/0"] }
}

resource "aws_iam_role" "ecs_task_execution" {
  name               = "${var.project}-ecs-task-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
}

data "aws_iam_policy_document" "ecs_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals { type = "Service"; identifiers = ["ecs-tasks.amazonaws.com"] }
  }
}

resource "aws_iam_role_policy_attachment" "ecs_execution" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy_attachment" "ecs_secrets" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/SecretsManagerReadWrite"
}

resource "aws_iam_role_policy_attachment" "ecs_s3" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonS3FullAccess"
}

locals {
  common_env = [
    { name = "DATABASE_URL";      value = "postgresql+asyncpg://energyos:${var.db_password}@${aws_db_instance.postgres.address}:5432/energyos" },
    { name = "DATABASE_SYNC_URL"; value = "postgresql+psycopg2://energyos:${var.db_password}@${aws_db_instance.postgres.address}:5432/energyos" },
    { name = "REDIS_URL";         value = "redis://${aws_elasticache_replication_group.redis.primary_endpoint_address}:6379/0" },
    { name = "ENTSOE_TOKEN";      value = var.entsoe_token },
    { name = "S3_BUCKET";         value = aws_s3_bucket.models.bucket },
    { name = "AWS_REGION";        value = var.aws_region },
  ]
}

# ── Backend ────────────────────────────────────────────────────────────────────
resource "aws_ecs_task_definition" "backend" {
  family                   = "${var.project}-backend"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 512
  memory                   = 1024
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn            = aws_iam_role.ecs_task_execution.arn

  container_definitions = jsonencode([{
    name        = "backend"
    image       = var.backend_image
    portMappings = [{ containerPort = 8000 }]
    environment = local.common_env
    logConfiguration = {
      logDriver = "awslogs"
      options   = { "awslogs-group" = "/ecs/${var.project}/backend"; "awslogs-region" = var.aws_region; "awslogs-stream-prefix" = "backend" }
    }
  }])
}

resource "aws_ecs_service" "backend" {
  name            = "${var.project}-backend"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.backend.arn
  desired_count   = 2
  launch_type     = "FARGATE"

  network_configuration {
    subnets         = aws_subnet.private[*].id
    security_groups = [aws_security_group.ecs_tasks.id]
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.backend.arn
    container_name   = "backend"
    container_port   = 8000
  }
}

# ── Celery worker ─────────────────────────────────────────────────────────────
resource "aws_ecs_task_definition" "worker" {
  family                   = "${var.project}-worker"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 1024
  memory                   = 4096
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn            = aws_iam_role.ecs_task_execution.arn

  container_definitions = jsonencode([{
    name        = "worker"
    image       = var.worker_image
    command     = ["celery", "-A", "app.workers.celery_app", "worker", "--loglevel=info", "-Q", "default,ml"]
    environment = local.common_env
    logConfiguration = {
      logDriver = "awslogs"
      options   = { "awslogs-group" = "/ecs/${var.project}/worker"; "awslogs-region" = var.aws_region; "awslogs-stream-prefix" = "worker" }
    }
  }])
}

resource "aws_ecs_service" "worker" {
  name            = "${var.project}-worker"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.worker.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets         = aws_subnet.private[*].id
    security_groups = [aws_security_group.ecs_tasks.id]
  }
}

# ── Celery beat ───────────────────────────────────────────────────────────────
resource "aws_ecs_task_definition" "beat" {
  family                   = "${var.project}-beat"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 256
  memory                   = 512
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn            = aws_iam_role.ecs_task_execution.arn

  container_definitions = jsonencode([{
    name        = "beat"
    image       = var.worker_image
    command     = ["celery", "-A", "app.workers.celery_app", "beat", "--loglevel=info"]
    environment = local.common_env
    logConfiguration = {
      logDriver = "awslogs"
      options   = { "awslogs-group" = "/ecs/${var.project}/beat"; "awslogs-region" = var.aws_region; "awslogs-stream-prefix" = "beat" }
    }
  }])
}

resource "aws_ecs_service" "beat" {
  name            = "${var.project}-beat"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.beat.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets         = aws_subnet.private[*].id
    security_groups = [aws_security_group.ecs_tasks.id]
  }
}

# ── Frontend ──────────────────────────────────────────────────────────────────
resource "aws_ecs_task_definition" "frontend" {
  family                   = "${var.project}-frontend"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 256
  memory                   = 512
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn

  container_definitions = jsonencode([{
    name         = "frontend"
    image        = var.frontend_image
    portMappings = [{ containerPort = 80 }]
    logConfiguration = {
      logDriver = "awslogs"
      options   = { "awslogs-group" = "/ecs/${var.project}/frontend"; "awslogs-region" = var.aws_region; "awslogs-stream-prefix" = "frontend" }
    }
  }])
}

resource "aws_ecs_service" "frontend" {
  name            = "${var.project}-frontend"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.frontend.arn
  desired_count   = 2
  launch_type     = "FARGATE"

  network_configuration {
    subnets         = aws_subnet.private[*].id
    security_groups = [aws_security_group.ecs_tasks.id]
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.frontend.arn
    container_name   = "frontend"
    container_port   = 80
  }
}

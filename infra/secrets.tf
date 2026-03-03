resource "aws_secretsmanager_secret" "db_password" {
  name = "${var.project}/db_password"
}

resource "aws_secretsmanager_secret_version" "db_password" {
  secret_id     = aws_secretsmanager_secret.db_password.id
  secret_string = var.db_password
}

resource "aws_secretsmanager_secret" "entsoe_token" {
  name = "${var.project}/entsoe_token"
}

resource "aws_secretsmanager_secret_version" "entsoe_token" {
  secret_id     = aws_secretsmanager_secret.entsoe_token.id
  secret_string = var.entsoe_token
}

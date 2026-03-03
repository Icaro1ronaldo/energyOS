variable "aws_region" {
  default = "eu-west-1"
}

variable "project" {
  default = "energyos"
}

variable "environment" {
  default = "prod"
}

variable "db_password" {
  description = "RDS master password"
  sensitive   = true
}

variable "entsoe_token" {
  description = "ENTSO-E API token"
  sensitive   = true
}

variable "backend_image" {
  description = "ECR image URI for the backend service"
}

variable "worker_image" {
  description = "ECR image URI for the Celery worker"
}

variable "frontend_image" {
  description = "ECR image URI for the frontend service"
}

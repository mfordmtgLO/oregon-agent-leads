ALTER TABLE `provider_connections` ADD `api_key_env_var` varchar(120);--> statement-breakpoint
ALTER TABLE `provider_connections` ADD `oauth_client_id_env_var` varchar(120);--> statement-breakpoint
ALTER TABLE `provider_connections` ADD `webhook_secret_env_var` varchar(120);
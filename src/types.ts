export interface Env {
  R2_BUCKET: R2Bucket;
  DB: D1Database;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  JWT_SECRET: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  CF_ACCOUNT_ID: string;
}

export interface Video {
  id: string;
  title: string;
  description: string;
  filename: string;
  content_type: string;
  file_size: number;
  r2_key: string;
  thumbnail_r2_key: string;
  uploader_github_id: number;
  uploader_username: string;
  uploader_avatar_url: string;
  created_at: string;
  updated_at: string;
}

export interface JwtPayload {
  sub: number;
  username: string;
  avatar: string;
  exp: number;
  iat: number;
  is_guest?: boolean;
}

export interface GitHubUser {
  id: number;
  login: string;
  avatar_url: string;
}

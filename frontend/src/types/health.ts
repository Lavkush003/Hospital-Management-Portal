export interface HealthResponse {
  status: 'ok';
  service: string;
  environment: 'development' | 'test' | 'production';
  timestamp: string;
  uptime: number;
}

import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  port: parseInt(process.env.PORT as string, 10) || 3000,
  env: process.env.NODE_ENV || 'development',
}));

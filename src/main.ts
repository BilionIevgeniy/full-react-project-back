import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
	const app = await NestFactory.create(AppModule);
	// Включаем CORS
	app.enableCors({
		origin: 'http://localhost:3005', // Указываем конкретный источник твоего фронтенда
		methods: 'GET,HEAD,PUT,PATCH,POST,DELETE', // Разрешенные HTTP методы
		credentials: true, // Разрешить куки, заголовки авторизации и т.д. (если нужно)
	});
	await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();

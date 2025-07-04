import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TranslationsModule } from './translations/translations.module';

@Module({
	imports: [
		ConfigModule.forRoot({
			isGlobal: true,
		}),
		CacheModule.register({
			// Настройки кэша:
			// ttl - время жизни кэша в секундах.
			// Например, 3600 секунд = 1 час. Через час данные обновятся из Google Таблицы.
			ttl: 3600, // Кэшировать на 1 час
			max: 100, // Максимальное количество элементов в кэше (опционально)
			isGlobal: true, // Сделать CacheModule глобально доступным
			// Если ты захочешь использовать Redis или другой внешний кэш, это будет выглядеть так:
			// store: redisStore,
			// host: 'localhost',
			// port: 6379,
		}),
		TranslationsModule,
	],
	controllers: [AppController],
	providers: [AppService],
})
export class AppModule {}

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
      // Cache settings:
      // ttl - cache lifetime in seconds.
      // For example, 3600 seconds = 1 hour. After an hour, the data will be updated from the Google Sheet.
      ttl: 3600, // Cache for 1 hour
      // max: 100, // Maximum number of items in the cache (optional)
      isGlobal: true, // Make CacheModule globally available
      // If you want to use Redis or another external cache, it would look like this:
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

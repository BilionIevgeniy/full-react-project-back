// src/translations/translations.controller.ts
import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { TranslationsService } from './translations.service'; // Импортируем сервис

@Controller('translations') // Базовый путь для всех эндпоинтов в этом контроллере
export class TranslationsController {
	constructor(private readonly translationsService: TranslationsService) {}

	@Get() // Метод GET для корневого пути этого контроллера (/translations)
	async getTranslations(@Query('lang') lang: string, @Query('ns') ns?: string) {
		if (!lang) {
			// Если параметр lang отсутствует, возвращаем ошибку 400 Bad Request
			throw new BadRequestException('Language parameter (lang) is required.');
		}
		if (ns) {
			// Если указан неймспейс, запрашиваем только его
			return await this.translationsService.getTranslationsByNamespace(lang, ns);
		} else {
			// Иначе (например, для общих переводов или если ns не указан), можно загрузить все или дефолтный
			// В данном случае, пусть по умолчанию загружает common
			return await this.translationsService.getTranslationsByNamespace(lang, 'common');
		}
	}
}

// src/translations/translations.controller.ts
import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { TranslationsService } from './translations.service'; // Import the service

@Controller('translations') // Base path for all endpoints in this controller
export class TranslationsController {
  constructor(private readonly translationsService: TranslationsService) {}

  @Get() // GET method for the root path of this controller (/translations)
  async getTranslations(@Query('lang') lang: string, @Query('ns') ns?: string) {
    if (!lang) {
      // If the lang parameter is missing, return a 400 Bad Request error
      throw new BadRequestException('Language parameter (lang) is required.');
    }
    if (ns) {
      // If a namespace is specified, request only that one
      return await this.translationsService.getTranslationsByNamespace(lang, ns);
    } else {
      // Otherwise (e.g., for common translations or if ns is not specified), load all or default
      // In this case, let it default to loading 'common'
      return await this.translationsService.getTranslationsByNamespace(lang, 'common');
    }
  }
}

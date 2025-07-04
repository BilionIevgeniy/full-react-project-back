import { Injectable, InternalServerErrorException, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library'; // Импортируем JWT для авторизации
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import googleConfig from 'src/config/google.config';

@Injectable()
export class TranslationsService {
	private readonly logger = new Logger(TranslationsService.name);
	private doc: GoogleSpreadsheet;
	private spreadsheetId: string;
	private serviceAccountEmail: string;
	private privateKey: string;

	constructor(
		private configService: ConfigService,
		@Inject(CACHE_MANAGER) private cacheManager: Cache
	) {
		// Получение переменных окружения.
		// Присваиваем временно undefined, чтобы TypeScript не ругался до validateConfig.
		const spreadsheetId = this.configService.get<string>('GOOGLE_SPREADSHEET_ID');
		const serviceAccountEmail = this.configService.get<string>('GOOGLE_SERVICE_ACCOUNT_EMAIL');
		// Для v4.x.x ключ должен быть без BEGIN/END PRIVATE KEY в .env,
		// но все еще нужно заменить \\n на \n, если платформа их кодирует.
		const privateKey = googleConfig().google.privateKey;

		// Проверяем, что все переменные окружения определены перед продолжением.
		// Если какая-то из них undefined, бросаем ошибку, предотвращая запуск сервиса.
		this.validateConfig(spreadsheetId, serviceAccountEmail, privateKey);

		// После успешной валидации мы уверены, что значения не undefined
		this.spreadsheetId = spreadsheetId as string;
		this.serviceAccountEmail = serviceAccountEmail as string;
		this.privateKey = privateKey;

		// Создаем JWT объект для авторизации.
		// В v4.x.x GoogleSpreadsheet ожидает объект JWT или AuthClient в конструкторе.
		const auth = new JWT({
			email: this.serviceAccountEmail,
			key: this.privateKey,
			scopes: [
				'https://www.googleapis.com/auth/spreadsheets', // Только чтение, если не нужно редактировать
				// 'https://www.googleapis.com/auth/drive.file', // Опционально: если нужно управлять файлами на Drive
			],
		});
		// Инициализируем GoogleSpreadsheet с ID таблицы и объектом авторизации.
		this.doc = new GoogleSpreadsheet(this.spreadsheetId, auth);

		// В v4.x.x метод useServiceAccountAuth больше не вызывается явно после конструктора,
		// так как авторизация уже настроена через объект JWT.
		this.logger.log('TranslationsService initialized successfully.');
	}

	/**
	 * Приватный метод для валидации переменных окружения.
	 * Бросает ошибку, если какая-либо переменная отсутствует.
	 */
	private validateConfig(spreadsheetId?: string, serviceAccountEmail?: string, privateKey?: string): void {
		if (!spreadsheetId) {
			const errorMessage = 'GOOGLE_SPREADSHEET_ID is not defined in environment variables.';
			this.logger.error(errorMessage);
			throw new Error(`Configuration error: ${errorMessage}`);
		}
		if (!serviceAccountEmail) {
			const errorMessage = 'GOOGLE_SERVICE_ACCOUNT_EMAIL is not defined in environment variables.';
			this.logger.error(errorMessage);
			throw new Error(`Configuration error: ${errorMessage}`);
		}
		if (!privateKey) {
			const errorMessage =
				"GOOGLE_PRIVATE_KEY is not defined or could not be processed. Make sure it's correctly set up in .env.";
			this.logger.error(errorMessage);
			throw new Error(`Configuration error: ${errorMessage}`);
		}
		this.logger.log('Google Sheet API configuration loaded successfully.');
	}

	/**
	 * Получает переводы для указанного языка из Google Таблицы.
	 * Кэширует результаты для повышения производительности.
	 * @param lang Код языка (например, 'ru', 'en').
	 * @returns Объект с переводами { key: value }.
	 */
	// Метод для получения переводов по конкретному неймспейсу (листу)
	async getTranslationsByNamespace(lang: string, ns: string): Promise<Record<string, string>> {
		const cacheKey = `translations:${ns}:${lang}`;
		const cachedTranslations = await this.cacheManager.get<Record<string, string>>(cacheKey);

		if (cachedTranslations) {
			this.logger.log(`Translations for ns: ${ns}, lang: ${lang} found in cache.`);
			return cachedTranslations;
		}

		this.logger.log(`Fetching translations for ns: ${ns}, lang: ${lang} from Google Sheets.`);
		try {
			// Загружаем информацию о таблице.
			// В v4.x.x метод loadInfo() загружает метаданные таблицы,
			// включая названия листов, заголовки и т.д.
			// Это необходимо для работы с таблицей.
			await this.doc.loadInfo();
			// Загрузка информации о таблице и листах.
			// Авторизация уже произошла в конструкторе.

			// Ищем лист по названию (неймспейсу)
			const sheet = this.doc.sheetsByTitle[ns];

			if (!sheet) {
				this.logger.warn(`Sheet (namespace) '${ns}' not found in spreadsheet.`);
				throw new Error('Translations sheet not found. Ensure it is the first sheet or specify by title.');
			}
			// Загружаем заголовки столбцов (первая строка таблицы).
			// В v4.x.x метод loadHeaderRow() загружает заголовки
			// и позволяет работать с ними как с массивом.
			await sheet.loadHeaderRow();

			// Проверяем, существует ли столбец для запрашиваемого языка
			if (!sheet.headerValues.includes(lang)) {
				this.logger.warn(`Language column '${lang}' not found in sheet '${ns}'.`);
				throw new Error(`Language column '${lang}' not found in sheet '${ns}'. Ensure it exists.`);
			}

			// getRows() возвращает массив строк таблицы.
			// В v4.x.x он возвращает массив объектов, где ключи - это заголовки столбцов,
			// а значения - это значения в соответствующих ячейках.
			// Это позволяет легко работать с данными таблицы.
			const rows = await sheet.getRows();
			const translations: Record<string, string> = {};

			rows.forEach((row) => {
				// Предполагаем, что первая колонка - это 'key', а остальные - языки ('en', 'ru' и т.д.)
				// `row.get()` корректно типизирован в v4.x.x, но явное приведение к string для ясности.
				const key = row.get('key') as string;
				const value = row.get(lang) as string;

				if (key && value) {
					translations[key] = value;
				}
			});

			await this.cacheManager.set(cacheKey, translations, 60 * 60 * 1000); // Кэшируем на 1 час (3600000 ms)
			this.logger.log(`Translations for ns: ${ns}, lang: ${lang} fetched and cached.`);
			return translations;
		} catch (error: unknown) {
			if (error instanceof Error) {
				this.logger.error(`Failed to fetch translations for ${lang} from Google Sheet:`, error.message, error.stack);
			} else {
				this.logger.error(`Failed to fetch translations for ${lang} from Google Sheet: An unknown error occurred.`);
			}
			throw new InternalServerErrorException(
				`Failed to retrieve translations for ${lang}. Please check sheet permissions or configuration.`
			);
		}
	}
}

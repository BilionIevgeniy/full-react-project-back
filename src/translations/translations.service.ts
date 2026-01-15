import { Injectable, InternalServerErrorException, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library'; // Import JWT for authorization
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
		// Getting environment variables.
		// Temporarily assign undefined so TypeScript doesn't complain before validateConfig.
		const spreadsheetId = this.configService.get<string>('GOOGLE_SPREADSHEET_ID');
		const serviceAccountEmail = this.configService.get<string>('GOOGLE_SERVICE_ACCOUNT_EMAIL');
		// For v4.x.x the key must be without BEGIN/END PRIVATE KEY in .env,
		// but still need to replace \\n with \n if the platform encodes them.
		const privateKey = googleConfig().google.privateKey;

		// Check that all environment variables are defined before proceeding.
		// If any of them is undefined, throw an error, preventing the service from starting.
		this.validateConfig(spreadsheetId, serviceAccountEmail, privateKey);

		// After successful validation, we are sure that the values are not undefined
		this.spreadsheetId = spreadsheetId as string;
		this.serviceAccountEmail = serviceAccountEmail as string;
		this.privateKey = privateKey;

		// Create JWT object for authorization.
		// In v4.x.x GoogleSpreadsheet expects a JWT or AuthClient object in the constructor.
		const auth = new JWT({
			email: this.serviceAccountEmail,
			key: this.privateKey,
			scopes: [
				'https://www.googleapis.com/auth/spreadsheets', // Read only, if editing is not needed
				// 'https://www.googleapis.com/auth/drive.file', // Optional: if you need to manage files on Drive
			],
		});
		// Initialize GoogleSpreadsheet with spreadsheet ID and authorization object.
		this.doc = new GoogleSpreadsheet(this.spreadsheetId, auth);

		// In v4.x.x the useServiceAccountAuth method is no longer called explicitly after the constructor,
		// as authorization is already configured via the JWT object.
		this.logger.log('TranslationsService initialized successfully.');
	}

	/**
	 * Private method to validate environment variables.
	 * Throws an error if any variable is missing.
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
	 * Retrieves translations for the specified language from Google Sheets.
	 * Caches results to improve performance.
	 * @param lang Language code (e.g., 'ru', 'en').
	 * @returns Object with translations { key: value }.
	 */
	// Method to get translations for a specific namespace (sheet)
	async getTranslationsByNamespace(lang: string, ns: string): Promise<Record<string, string>> {
		const cacheKey = `translations:${ns}:${lang}`;
		const cachedTranslations = await this.cacheManager.get<Record<string, string>>(cacheKey);

		if (cachedTranslations) {
			this.logger.log(`Translations for ns: ${ns}, lang: ${lang} found in cache.`);
			return cachedTranslations;
		}

		this.logger.log(`Fetching translations for ns: ${ns}, lang: ${lang} from Google Sheets.`);
		try {
			// Load spreadsheet info.
			// In v4.x.x the loadInfo() method loads spreadsheet metadata,
			// including sheet names, headers, etc.
			// This is necessary to work with the spreadsheet.
			await this.doc.loadInfo();
			// Loading info about the spreadsheet and sheets.
			// Authorization already happened in the constructor.

			// Find sheet by title (namespace)
			const sheet = this.doc.sheetsByTitle[ns];

			if (!sheet) {
				this.logger.warn(`Sheet (namespace) '${ns}' not found in spreadsheet.`);
				throw new Error('Translations sheet not found. Ensure it is the first sheet or specify by title.');
			}
			// Load column headers (first row of the table).
			// In v4.x.x the loadHeaderRow() method loads headers
			// and allows working with them as an array.
			await sheet.loadHeaderRow();

			// Check if a column exists for the requested language
			if (!sheet.headerValues.includes(lang)) {
				this.logger.warn(`Language column '${lang}' not found in sheet '${ns}'.`);
				throw new Error(`Language column '${lang}' not found in sheet '${ns}'. Ensure it exists.`);
			}

			// getRows() returns an array of table rows.
			// In v4.x.x it returns an array of objects where keys are column headers,
			// and values are values in the corresponding cells.
			// This allows easy working with table data.
			const rows = await sheet.getRows();
			const translations: Record<string, string> = {};

			rows.forEach((row) => {
				// Assume the first column is 'key', and the rest are languages ('en', 'ru', etc.)
				// `row.get()` is correctly typed in v4.x.x, but explicit cast to string for clarity.
				const key = row.get('key') as string;
				const value = row.get(lang) as string;

				if (key && value) {
					translations[key] = value;
				}
			});

			await this.cacheManager.set(cacheKey, translations, 60 * 60 * 1000); // Cache for 1 hour (3600000 ms)
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

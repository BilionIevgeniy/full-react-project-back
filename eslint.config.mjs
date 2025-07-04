// @ts-check

// Импорты для плоского конфига
import eslint from '@eslint/js';
import prettierConfig from 'eslint-config-prettier'; // Импорт конфига, отключающего конфликтующие правила
import prettierPlugin from 'eslint-plugin-prettier'; // Импорт плагина Prettier
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
	{
		// Глобальные настройки для всех конфигов в этом файле
		// Это как корневые настройки в старом формате
		languageOptions: {
			ecmaVersion: 2022, // Поддержка последних фич JS
			sourceType: 'module', // Используем ES-модули (NestJS по умолчанию использует ESM или CommonJS, но для .mjs лучше module)
			globals: {
				...globals.node, // NestJS - это Node.js проект
				// ...globals.jest, // Добавь, если используешь Jest и нужны его глобальные переменные в тестах
			},
			parserOptions: {
				project: true, // Искать tsconfig.json автоматически
				tsconfigRootDir: import.meta.dirname, // Указываем корневую директорию для tsconfig.json
				// Для NestJS, JSX обычно не нужен, поэтому `jsx: true` убираем.
			},
		},
		// Настройки для разрешения модулей импорта, полезно для абсолютных путей
		settings: {
			'import/resolver': {
				node: {
					extensions: ['.js', '.ts'], // Только JS и TS для NestJS бэкенда
				},
				typescript: {
					// Добавляем резолвер для TypeScript
					alwaysTryTypes: true,
					project: './tsconfig.json', // Явно указываем tsconfig для резолвера
				},
			},
		},
	},
	{
		// Игнорируемые файлы и папки
		// Важно игнорировать сам файл конфига, node_modules, а также скомпилированные JS файлы
		ignores: [
			'eslint.config.mjs',
			'node_modules/',
			'dist/', // Скомпилированные файлы NestJS
			'build/',
			'**/*.js', // Игнорируем все JS файлы, так как работаем с TS
			'**/*.jsx', // Если вдруг есть, тоже игнорируем
		],
	},
	// Базовые рекомендуемые правила ESLint
	eslint.configs.recommended,

	// Конфиги для TypeScript
	...tseslint.configs.recommendedTypeChecked, // Рекомендуемые правила TypeScript с проверкой типов
	// ...tseslint.configs.stylisticTypeChecked, // Опционально: более стилистические правила TypeScript (можно включить, если хочешь)

	// Интеграция с Prettier
	{
		plugins: {
			prettier: prettierPlugin,
		},
		rules: {
			// Отключает все конфликтующие правила ESLint,
			// чтобы Prettier был единственным источником форматирования.
			...prettierConfig.rules,

			// Правило, которое проверяет соответствие кода настройкам Prettier.
			// Здесь указываем настройки Prettier напрямую, чтобы ESLint знал, что ожидать.
			'prettier/prettier': [
				'error',
				{
					useTabs: true,
					tabWidth: 2,
					endOfLine: 'lf', // Важно для решения проблемы с `␍`
					// Можешь добавить сюда остальные настройки из твоего .prettierrc
					// printWidth: 120,
					// singleQuote: true,
					// trailingComma: 'es5',
					// semi: true,
					// jsxSingleQuote: false, // Неактуально для NestJS, но не повредит
					// bracketSpacing: true,
					// arrowParens: 'always'
				},
			],

			// Явное отключение правил форматирования, которые могут конфликтовать.
			indent: 'off',
			'@typescript-eslint/indent': 'off', // Важно, если это правило включено из других extends
		},
	},
	{
		// Твои кастомные правила и отключения для NestJS
		rules: {
			'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
			camelcase: 'off', // NestJS часто использует snake_case для полей из БД, поэтому это может быть полезно
			'guard-for-in': 'off',
			'no-restricted-syntax': 'off',
			'no-nested-ternary': 'off',
			'no-underscore-dangle': 'off', // Если NestJS использует _id и т.п.
			'max-len': [
				'warn',
				{
					code: 120,
					tabWidth: 2,
					comments: 120,
					ignoreComments: true,
					ignoreTrailingComments: true,
					ignoreUrls: true,
					ignoreStrings: true,
					ignoreTemplateLiterals: true,
					ignoreRegExpLiterals: true,
				},
			],
			'max-classes-per-file': ['error', 3], // Можно настроить, если много контроллеров/сервисов в одном файле

			// TypeScript специфичные правила для NestJS
			'@typescript-eslint/no-explicit-any': 'warn', // Обычно в NestJS можно встретить `any`, но лучше предупреждать
			'@typescript-eslint/no-floating-promises': 'warn', // Важно для асинхронных операций
			'@typescript-eslint/no-unsafe-argument': 'warn', // Полезно для безопасности типов

			// Часто используемые правила в NestJS, которые могут конфликтовать с airbnb или @typescript-eslint
			'@typescript-eslint/interface-name-prefix': 'off', // Устарело, но если включено, можно отключить
			'@typescript-eslint/explicit-function-return-type': 'off', // Часто отключают, чтобы не писать типы возвращаемых значений везде
			'@typescript-eslint/explicit-module-boundary-types': 'off', // Тоже часто отключают
			'@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }], // Предупреждать о неиспользуемых, но игнорировать параметры начинающиеся с '_'
		},
	}
);

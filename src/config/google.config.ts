import { registerAs } from '@nestjs/config';

export default registerAs('google', () => ({
	google: {
		privateKey: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
		clientEmail: process.env.CLIENT_EMAIL,
	},
}));

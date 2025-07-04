import { registerAs } from '@nestjs/config';

export default registerAs('google', () => ({
	google: {
		privateKey: Buffer.from(process.env.GOOGLE_PRIVATE_KEY || '', 'base64').toString('ascii'),
		clientEmail: process.env.CLIENT_EMAIL,
	},
}));

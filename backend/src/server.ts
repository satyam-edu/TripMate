import express, { type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(helmet());
app.use(cors());
app.use(express.json());

// Basic Route
app.get('/api/health', (req: Request, res: Response) => {
  res.status(200).json({ status: "API is breathing" });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

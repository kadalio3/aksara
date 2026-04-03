import 'dotenv/config';
import express, { Request, Response } from 'express';
import userRouter from './routes/user-route';
import followRouter from './routes/follow-route';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Pemasangan router API
app.use('/api', userRouter);
app.use('/api', followRouter);

app.get('/', (req: Request, res: Response) => {
  res.json({ message: 'Hello World' });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

import 'dotenv/config';
import express, { Request, Response } from 'express';
import userRouter from './routes/user-route';
import followRouter from './routes/follow-route';
import postsRouter from './routes/posts-route';
import communitiesRouter from './routes/communities-route';
import bookmarksRouter from './routes/bookmarks-route';
import messagesRouter from './routes/messages-route';
import notificationsRouter from './routes/notifications-route';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Pemasangan router API
app.use('/api', userRouter);
app.use('/api', followRouter);
app.use('/api', postsRouter);
app.use('/api', communitiesRouter);
app.use('/api', bookmarksRouter);
app.use('/api', messagesRouter);
app.use('/api', notificationsRouter);

app.get('/', (req: Request, res: Response) => {
  res.json({ message: 'Hello World' });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

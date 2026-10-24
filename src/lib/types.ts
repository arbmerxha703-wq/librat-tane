export type Book = {
  id: string;
  title: string;
  author: string;
  shelf: string;
  position: number;
  is_read: boolean;
  is_sample: boolean;
  created_at: string;
};

export type NewBook = {
  title: string;
  author: string;
  shelf: string;
  position: number;
  is_read: boolean;
};

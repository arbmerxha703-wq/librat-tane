import type { NewBook } from "./types";

export const SAMPLE_BOOKS: NewBook[] = [
  { title: "Gjenerali i ushtrisë së vdekur", author: "Ismail Kadare", shelf: "1", position: 1, is_read: true },
  { title: "Kronikë në gur", author: "Ismail Kadare", shelf: "1", position: 2, is_read: true },
  { title: "Pallati i ëndrrave", author: "Ismail Kadare", shelf: "1", position: 3, is_read: false },
  { title: "Lahuta e Malcís", author: "Gjergj Fishta", shelf: "2", position: 1, is_read: false },
  { title: "Bagëti e Bujqësi", author: "Naim Frashëri", shelf: "2", position: 2, is_read: true },
  { title: "Njeriu me top", author: "Dritëro Agolli", shelf: "2", position: 3, is_read: true },
  { title: "Lumi i vdekur", author: "Jakov Xoxa", shelf: "3", position: 1, is_read: false },
  { title: "Lufta dhe paqja", author: "Lev Tolstoi", shelf: "3", position: 2, is_read: false },
  { title: "Njëqind vjet vetmi", author: "Gabriel García Márquez", shelf: "4", position: 1, is_read: true },
  { title: "Krim dhe ndëshkim", author: "Fjodor Dostojevski", shelf: "4", position: 2, is_read: false },
];

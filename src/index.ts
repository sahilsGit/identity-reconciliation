import { db } from "./bin/db.js";
import express, { Request, Response } from "express";
import dotenv from "dotenv";
import { Prisma } from "@prisma/client";
import { ApiError, errorHandler } from "./utils.js";

// Request interface
interface RequestBody {
  email?: string;
  phoneNumber?: number;
}

// Contact interface
interface Contact {
  id: number;
  phoneNumber: string | null;
  email: string | null;
  linkedId: number | null;
  linkPrecedence: "primary" | "secondary";
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

dotenv.config(); // to use environment variables
const app = express(); // to instantiate express app

const port = process.env.PORT || 3000; // Port

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

// Middleware to parse JSON request bodies
app.use(express.json());

// Helper function to create response
async function responseCreatorHelper(primaryContact: Contact, res: Response) {
  /*
   * Create Response here
   *
   */
}

app.post(
  "/identify",
  async (req: Request<{}, {}, RequestBody>, res: Response) => {}
);

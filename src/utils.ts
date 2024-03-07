import { Response } from "express";

/**
 * @description All-Purpose Error class that handles all sorts of errors
 */
class ApiError extends Error {
  statusCode: number;
  message: string;
  success: boolean;

  /**
   * @param statusCode
   * @param message
   */
  constructor(statusCode = 500, message = "Something went wrong!") {
    super(message);
    this.statusCode = statusCode;
    this.message = message;
    this.success = false;
  }
}

/**
 * @description All-Purpose Error handler
 */
const errorHandler = (
  res: Response,
  statusCode: number = 500,
  message: string = "Internal Server Error"
) => {
  res.status(statusCode).json({ success: false, message });
};

export { ApiError, errorHandler };

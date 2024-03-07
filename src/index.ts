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
  // Find all linked secondary contacts
  const secondaryContacts = await db.contact.findMany({
    where: {
      linkedId: primaryContact.id,
      linkPrecedence: "secondary",
    },
  });

  /*
   *
   * Construct the response
   */

  const emails = new Set([
    primaryContact.email,
    ...secondaryContacts.map((c) => c.email).filter(Boolean),
  ]); // Set to include unique elements only

  const phoneNumbers = new Set([
    primaryContact.phoneNumber,
    ...secondaryContacts.map((c) => c.phoneNumber).filter(Boolean),
  ]); // Set to include unique elements only

  const secondaryContactIds = secondaryContacts.map((c) => c.id);

  res.status(200).json({
    contact: {
      primaryContactId: primaryContact.id,
      emails: [...emails], // Spread set to form an array
      phoneNumbers: [...phoneNumbers], // Spread set to form an array
      secondaryContactIds,
    },
  });
}

app.post(
  "/identify",
  async (req: Request<{}, {}, RequestBody>, res: Response) => {
    /*
     *
     * Main endpoint that will either:
     * Create a new contact & return details of all the contacts referring to it
     *
     * OR
     *
     * Return details of all the contacts referring to it without creating one
     *
     *
     */

    try {
      // Get data from body
      const { email, phoneNumber } = req.body;

      // Throw error if both email & phoneNumber are absent
      if (!email && !phoneNumber) {
        throw new ApiError(404, "Both email & phoneNumber can't be empty!");
      }

      // Store the where conditions, as either "email" or "phoneNumber" can be optional
      const whereClause: Prisma.contactWhereInput = {
        OR: [],
      };

      // To store the stringified phoneNumber
      let stringifiedPhoneNumber: any = phoneNumber;

      // Add the email checking condition if email exists
      if (email) {
        whereClause.OR?.push({ email });
      }

      if (phoneNumber) {
        // Stringify phone number because it comes as a number and is saved as a string in db
        stringifiedPhoneNumber = phoneNumber.toString();

        // Add the phoneNumber checking condition if phoneNumber exists
        whereClause.OR?.push({ phoneNumber: stringifiedPhoneNumber });
      }

      // Check if the contact exists as it is
      const foundIt = await db.contact.findFirst({
        where: {
          AND: [
            {
              phoneNumber: stringifiedPhoneNumber,
            },
            {
              email,
            },
          ],
        },
      });

      // If contact already exists then create response and return
      if (foundIt) {
        await responseCreatorHelper(foundIt, res);
        return;
      }

      // If contact doesn't exists "as it is" then look for relative matches

      // Find referring primary and secondary contacts
      const matchingContacts = await db.contact.findMany({
        where: {
          ...whereClause,
        },
      });

      let primaryMatches: any, secondaryMatches: any;

      if (matchingContacts.length > 0) {
        // divide the array into two, namely "primaryMatches" & "secondaryMatches"
        primaryMatches = matchingContacts.filter(
          (contact) => contact.linkPrecedence === "primary"
        );
        secondaryMatches = matchingContacts.filter(
          (contact) => contact.linkPrecedence === "secondary"
        );

        // Check if referring primary contacts were found
        if (primaryMatches.length > 0) {
          /*
           *
           */

          if (primaryMatches.length > 1) {
            /*
             *
             * This is only possible when new contact has
             * email from one primary contact and phoneNumber
             * from the other primary contact
             *
             */

            // Demote the newer primary contact to secondary
            let stayedPrimary: Contact;
            let becameSecondary: Contact;

            if (primaryMatches[0].createdAt < primaryMatches[1].createdAt) {
              // 0'th element is older
              await db.contact.update({
                where: {
                  id: primaryMatches[1].id,
                },
                data: {
                  linkPrecedence: "secondary",
                  linkedId: primaryMatches[0].id,
                },
              });
              stayedPrimary = primaryMatches[0];
              becameSecondary = primaryMatches[1];
            } else {
              // 1'th element is older
              await db.contact.update({
                where: {
                  id: primaryMatches[0].id,
                },
                data: {
                  linkPrecedence: "secondary",
                  linkedId: primaryMatches[1].id,
                },
              });
              stayedPrimary = primaryMatches[1];
              becameSecondary = primaryMatches[0];
            }

            // Update secondary contacts that were linked to the contact that became secondary
            await db.contact.updateMany({
              where: {
                linkedId: becameSecondary.id,
                linkPrecedence: "secondary",
              },
              data: {
                linkedId: stayedPrimary.id,
              },
            });

            // Create Response
            await responseCreatorHelper(stayedPrimary, res);
            return;
          } else {
            /*
             * This means the new contact refers to exactly one primary contact
             * but it might refer to another secondary contact
             * We must find it if that's the case
             *
             *
             */

            // Find that indirect reference
            const filteredSecondaryContacts = secondaryMatches.filter(
              (contact: Contact) => {
                return (
                  contact.linkedId === primaryMatches[0].id &&
                  contact.email !== primaryMatches[0].email &&
                  contact.phoneNumber !== primaryMatches[0].phoneNumber
                );
              }
            );

            // If an indirect reference is found then return the response without creating a new contact
            if (filteredSecondaryContacts.length > 0) {
              // Create Response
              await responseCreatorHelper(primaryMatches[0], res);
              return;
            }

            // If no indirect reference is found then create a new contact
            if (email && stringifiedPhoneNumber) {
              await db.contact.create({
                data: {
                  email: email || "",
                  phoneNumber: stringifiedPhoneNumber || "",
                  linkedId: primaryMatches[0].id, // link primaryContact
                  linkPrecedence: "secondary",
                  createdAt: new Date(),
                  updatedAt: new Date(),
                },
              });
            }

            // Create Response
            await responseCreatorHelper(primaryMatches[0], res);
            return;
            /*
             *
             *
             */
          }
        }

        // Flow reaches here only if no referring primary contact is found

        // Check if a referring secondary contacts are found
        if (secondaryMatches.length > 0) {
          // Find the actual primary contact
          const primaryContact = await db.contact.findFirst({
            where: {
              id: secondaryMatches[0].linkedId!,
            },
          });

          // Create a new contact referring to the actual primary contact
          if (email && stringifiedPhoneNumber) {
            await db.contact.create({
              data: {
                email: email || "",
                phoneNumber: stringifiedPhoneNumber || "",
                linkedId: primaryContact!.id, // Primary contact can't be null if secondary exists
                linkPrecedence: "secondary",
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            });
          }

          // Create Response
          await responseCreatorHelper(primaryContact!, res);
          return;
        }
      }

      /*
       *
       * Finally if flow reaches here that means both email & phoneNumber is unique
       * This will create a new Primary contact
       */

      // Creating new Primary contact

      const newPrimaryContact = await db.contact.create({
        data: {
          email: email || "",
          phoneNumber: stringifiedPhoneNumber || "",
          linkPrecedence: "primary",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // Create response & return it
      res.status(200).json({
        contact: {
          primaryContactId: newPrimaryContact.id,
          emails: newPrimaryContact.email ? [newPrimaryContact.email] : [],
          phoneNumbers: newPrimaryContact.phoneNumber
            ? [newPrimaryContact.phoneNumber]
            : [],
          secondaryContactIds: [],
        },
      });
    } catch (error: any) {
      // Handle error

      error instanceof ApiError
        ? errorHandler(res, error.statusCode, error.message)
        : errorHandler(res);
    }
  }
);

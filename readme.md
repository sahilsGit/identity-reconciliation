# Identity Reconciliation System

This project implements a Node.js microservice designed to identify and reconcile customer identities across multiple purchases on a an e-commerce platform.

It addresses the challenge of users using different email addresses and phone numbers for each order, potentially creating fragmented customer profiles.

Service link:
https://identity-reconciliation-k6gx.onrender.com/identify

Or

https://identity-reconciliation-production-d94a.up.railway.app/identify

## Contact Table

Below is the schema of Table `contact`, this is where contact information is saved.

```
contact {
  id                   Int     @id @default(autoincrement())
  phoneNumber          String?
  email                String?
  linkedId             Int? // the ID of another Contact linked to this
  linkPrecedence       linkPrecedence
  createdAt            DateTime
  updatedAt            DateTime
  deletedAt            DateTime?
}
```

One customer can have multiple `contact` rows against their name on Database.

All the `contact` rows are linked together using linkedId, where the oldest row receives a "primary" status and rest receive "secondary" status.

Each row can only link to its "primary" contact this means linkedId can never have id of a "secondary" contact.

## Creating Record

New records can be created by hitting a post request on `/identify` endpoint .

```
// Payload request format

{
  email?: string;
  phoneNumber?: number;
}
```

A `secondary` record / row be created if the payload brings in new information about an existing user.

    Either `email` or `phoneNumber` brought in should match with an existing contact while the other should.

    If `email` matches then `phoneNumber` shouldn't and vice versa.

A `primary` record /row will be created when the payload is completely unique.

    Neither `email` nor the `phoneNumber` should match to any of the existing records.

## Expected Response

Whenever a user hits the endpoint following designated format, irrespective of what happens (New record is created or not) the user receives response in the following format.

```
	{
		"contact":{
			"primaryContactId": number,
			"emails": string[], // first element being email of primary contact
			"phoneNumbers": string[], // first element being phoneNumber of primary contact
			"secondaryContactIds": number[] // Array of all Contact IDs that are "secondary" to the primary contact
		}
	}
```

## Demoting `primary` contacts to `secondary`

The `primary` contacts can become `secondary` when a request payload has `email` from one primary contact and `phoneNumber` from another primary contact.

This converts all the linking `primary` contacts to secondary, only the oldest one remains `primary`.

Whenever this happens all the contacts that were previously linking to contacts that became `secondary` will now link to the sole contact that remained `primary`.

// Import Request and Response types from Express for HTTP request handling
import { Request, Response } from "express";

// Import Firestore functions to interact with the database (collection, retrieving documents, etc.)
import { collection, getDocs, doc, getDoc } from "firebase/firestore";

// Import the configured Firestore database instance
import { db } from "../firebase";

// Import the User type for type-checking authenticated user data
import { User } from "../types";

// Define an interface for an attachment, outlining its structure (not utilized in this snippet)
interface Attachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

// Asynchronous function to list email logs for a specific organization
export const listLogs = async (req: Request, res: Response) => {
  try {
    // Extract organizationId from the authenticated user's data
    const { organizationId } = req.user.user as User;

    // If organizationId is missing, return a 400 error with a relevant message
    if (!organizationId) {
      return res.status(400).json({
        success: false,
        error: "Organization not found in user data",
        errorCode: "MISSING_ORGANIZATION_ID",
      });
    }

    // Create a reference to the "emailLogs" collection within the user's organization in Firestore
    const logsCollectionRef = collection(
      db,
      "emailLogs",
      organizationId,
      "emailLogs"
    );

    // Retrieve all documents (logs) from the collection
    const logsSnapshot = await getDocs(logsCollectionRef);

    // Map each document to an object containing its id and data fields
    const logs = logsSnapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    }));

    // Return a 200 response with the retrieved logs
    return res.status(200).json({
      success: true,
      logs,
    });
  } catch (error) {
    // Log the error for debugging purposes
    console.error("Error listing logs: ", error);

    // Return a 500 error response if something goes wrong during processing
    return res.status(500).json({
      success: false,
      error: "Internal server error",
      errorCode: "INTERNAL_SERVER_ERROR",
    });
  }
};

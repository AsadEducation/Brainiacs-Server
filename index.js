const express = require("express");
const cors = require("cors");
require("dotenv").config();
const port = process.env.PORT || 5000;
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

app.use(cors());
app.use(express.json());
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://brainiacs-team-collaboration.vercel.app",
      "https://testing-brainiacs.vercel.app",
    ],
  })
);

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ueh5c.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {

    const database = client.db("Brainiacs");
    const userCollection = client.db("Brainiacs").collection("users");
    const columnCollection = database.collection("Columns");
    const taskCollection = database.collection("Tasks");
    const boardCollection = client.db("Brainiacs").collection("boards");
    const rewardCollection = client.db("Brainiacs").collection("rewards");


// my Profile reward section
app.get("/myProfile", async (req, res) => {
      
  const tasks = await taskCollection.find().toArray();
  const rewardData = await rewardCollection.find().toArray();

  const completedTasks = tasks.filter((t) => t.columnTittle === "done");
  const completedCount = completedTasks.length;
  const points = completedCount * 10;

  const unlockedBadges = rewardData.filter((b) => points >= b.pointsRequired);
  const lockedBadges = rewardData.filter((b) => points < b.pointsRequired);

  const currentBadge = unlockedBadges[unlockedBadges.length - 1] || null;
  const nextBadge = lockedBadges[0] || null;

  const progressToNext = nextBadge
    ? Math.floor((points / nextBadge.pointsRequired) * 100)
    : 100;

  res.send({
    points,
    completedCount,
    currentBadge,
    nextBadge,
    progressToNext,
    badges: rewardData,
  });

});



    app.get("/users", async (req, res) => {
      const cursor = userCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    app.post("/users", async (req, res) => {
      const newUser = req.body;

      // Validation
      if (!newUser.name || !newUser.email) {
        return res.status(400).send({ error: "User name and email are required" });
      }

      try {
        // Check if the user already exists
        const existingUser = await userCollection.findOne({ email: newUser.email });
        if (existingUser) {
          return res.status(400).send({ error: "User already exists" });
        }

        // Set default role if not provided
        if (!newUser.role) {
          newUser.role = "user";
        }

        const result = await userCollection.insertOne(newUser);
        res.status(201).send(result);
      } catch (error) {
        console.error("Error saving user:", error);
        res.status(500).send({ error: "Failed to save user" });
      }
    });

    app.get("/user", async (req, res) => {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(400).send({ error: "Authorization token is required" });
      }

      const token = authHeader.split(" ")[1]; // Extract the token
      try {
        const email = req.query.email; // Use email from query parameters
        if (!email) {
          return res.status(400).send({ error: "Email query parameter is required" });
        }

        console.log(`Fetching user with email: ${email.trim()}`); // Log email being queried
        const user = await userCollection.findOne({ email: email.trim() });
        if (!user) {
          console.warn(`User not found for email: ${email.trim()}`); // Log if user is not found
          return res.status(404).send({ error: "User not found" });
        }

        res.send(user);
      } catch (error) {
        console.error("Error fetching user:", error);
        res.status(500).send({ error: "Failed to fetch user" });
      }
    });

    app.get("/user/:email", async (req, res) => {
      const { email } = req.params;

      try {
        if (!email) {
          return res.status(400).send({ error: "Email parameter is required" });
        }

        console.log(`Fetching user with email: ${email.trim()}`); // Log email being queried
        const user = await userCollection.findOne({ email: email.trim() });
        if (!user) {
          console.warn(`User not found for email: ${email.trim()}`); // Log if user is not found
          return res.status(404).send({ error: "User not found" });
        }

        res.send(user);
      } catch (error) {
        console.error("Error fetching user:", error);
        res.status(500).send({ error: "Failed to fetch user" });
      }
    });

    app.get("/users/search", async (req, res) => {
      const query = req.query.query;
      if (!query) {
        return res.status(400).send({ error: "Query parameter is required" });
      }

      try {
        const words = query.split(" ").slice(0, 3).join(" "); // Extract the first three words
        const regex = new RegExp(`^${words}`, "i"); // Match starting with the first three words
        const users = await userCollection
          .find({ $or: [{ name: regex }, { email: regex }] })
          .limit(3)
          .toArray();
        res.send(users);
      } catch (error) {
        res.status(500).send({ error: "Failed to search users" });
      }
    });

    app.get("/boards", async (req, res) => {
      try {
        const boards = await boardCollection.find().toArray();
        res.send(boards);
      } catch (error) {
        res.status(500).send({ error: "Failed to fetch boards" });
      }
    });

    app.get("/boards/:id", async (req, res) => {
      const { id } = req.params;
      const userId = req.query.userId; // Pass userId as a query parameter
    
      try {
        if (!ObjectId.isValid(id)) {
          return res.status(400).json({ error: "Invalid board ID" });
        }
    
        const board = await boardCollection.findOne({ _id: new ObjectId(id) });
    
        if (!board) {
          return res.status(404).json({ error: "Board not found" });
        }
    
        // Ensure messages field exists and is an array
        const messages = board.messages || [];
    
        // Filter out expired pinned messages
        const currentTime = new Date();
        const validPinnedMessages = messages.filter(
          (msg) => msg.pinnedBy && new Date(msg.pinExpiry) > currentTime
        );
    
        // Populate member details
        const memberDetails = await userCollection
          .find({ _id: { $in: board.members.map((member) => new ObjectId(member.userId)) } })
          .toArray();
    
        const populatedMembers = board.members.map((member) => {
          const user = memberDetails.find((user) => user._id.toString() === member.userId);
          return {
            ...member,
            name: user?.name || "Unknown",
            email: user?.email || "Unknown",
            role: member.role || "member",
          };
        });
    
        // Calculate unseen messages
        const unseenCount = messages.filter(
          (msg) => !msg.seenBy?.includes(userId)
        ).length;
    
        // Get the last message
        const lastMessage = messages[messages.length - 1] || null;
    
        res.json({
          ...board,
          members: populatedMembers,
          unseenCount,
          lastMessage,
          polls: board.polls || [], // Include polls in the response
          pinnedMessages: validPinnedMessages.map((msg) => ({
            ...msg,
            pinExpiry: msg.pinExpiry, // Include pinExpiry in the response
          })),
        });
      } catch (error) {
        console.error("Error fetching board:", error);
        res.status(500).json({ error: "Failed to fetch board" });
      }
    });
    

    app.post("/boards", async (req, res) => {
      const { name, description, visibility, theme, createdBy } = req.body; // Include description
    
      // Validation
      if (!name) {
        return res.status(400).send({ error: "Board name is required" });
      }
      if (!createdBy) {
        return res.status(400).send({ error: "createdBy is required" });
      }
      if (!ObjectId.isValid(createdBy)) {
        return res.status(400).send({ error: "Invalid createdBy ID" });
      }
    
      try {
        const createdAt = new Date().toISOString();
    
        // Fetch the creator's details from the users collection
        const creator = await userCollection.findOne({ _id: new ObjectId(createdBy) });
        if (!creator) {
          return res.status(404).send({ error: "Creator not found" });
        }
    
        const newBoard = {
          name,
          description: description || "", // Default to empty string if not provided
          visibility: visibility || "Public",
          theme: theme || "#3b82f6",
          createdBy,
          members: [
            {
              userId: createdBy,
              name: creator.name,
              email: creator.email,
              role: "admin", // Set the creator as admin
            },
          ],
          createdAt,
        };
    
        const result = await boardCollection.insertOne(newBoard);
    
        res.status(201).send({
          ...newBoard,
          _id: result.insertedId,
        });
      } catch (error) {
        console.error("Error creating board:", error);
        res.status(500).send({ error: "Failed to create board" });
      }
    });

    app.put("/boards/:id", async (req, res) => {
      const { id } = req.params;
      const { members } = req.body;

      try {
        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ error: "Invalid board ID" });
        }

        if (members) {
          if (!Array.isArray(members)) {
            return res.status(400).send({ error: "Members must be an array" });
          }

          // Validate each member's data
          for (const member of members) {
            if (!member.userId || !ObjectId.isValid(member.userId)) {
              return res.status(400).send({ error: `Invalid userId: ${member.userId}` });
            }
          }
        }

        const result = await boardCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { members } }
        );

        if (result.matchedCount === 0) {
          return res.status(404).send({ error: "Board not found" });
        }

        res.send({ message: "Board updated successfully" });
      } catch (error) {
        console.error("Error updating board:", error);
        res.status(500).send({ error: "Failed to update board" });
      }
    });

    app.put("/boards/:id/messages", async (req, res) => {
      const { id } = req.params;
      const { senderId, senderName, text, attachments } = req.body;
    
      // Validation
      if (!ObjectId.isValid(id)) {
        return res.status(400).send({ error: "Invalid board ID" });
      }
      if (!senderId || !ObjectId.isValid(senderId)) {
        return res.status(400).send({ error: "Invalid sender ID" });
      }
      if (!text) {
        return res.status(400).send({ error: "Message text is required" });
      }
    
      try {
        const board = await boardCollection.findOne({ _id: new ObjectId(id) });
        if (!board) {
          return res.status(404).send({ error: "Board not found" });
        }
    
        const message = {
          messageId: new ObjectId(), // Unique ID for the message
          senderId,
          senderName: senderName || "Unknown User", // Default to "Unknown User" if senderName is not provided
          text,
          attachments: attachments || [], // Default to an empty array if no attachments
          timestamp: new Date().toISOString(),
        };
    
        const result = await boardCollection.updateOne(
          { _id: new ObjectId(id) },
          { $push: { messages: message } }
        );
    
        if (result.matchedCount === 0) {
          return res.status(404).send({ error: "Board not found" });
        }
    
        res.send({ message: "Message added successfully", message });
      } catch (error) {
        console.error("Error adding message to board:", error);
        res.status(500).send({ error: "Failed to add message to board" });
      }
    });
    
    app.patch("/boards/:boardId/messages/:messageId", async (req, res) => {
      const { boardId, messageId } = req.params;
      const { text } = req.body;
    
      if (!ObjectId.isValid(boardId) || !ObjectId.isValid(messageId)) {
        return res.status(400).send({ error: "Invalid board or message ID" });
      }
    
      try {
        const result = await boardCollection.updateOne(
          { _id: new ObjectId(boardId), "messages.messageId": new ObjectId(messageId) }, // Convert messageId to ObjectId
          { $set: { "messages.$.text": text } }
        );
    
        if (result.matchedCount === 0) {
          return res.status(404).send({ error: "Message not found" });
        }
    
        const updatedBoard = await boardCollection.findOne({ _id: new ObjectId(boardId) });
        const updatedMessage = updatedBoard.messages.find(
          (msg) => msg.messageId.toString() === messageId
        );
    
        res.send(updatedMessage);
      } catch (error) {
        console.error("Error editing message:", error);
        res.status(500).send({ error: "Failed to edit message" });
      }
    });
    
    app.delete("/boards/:boardId/messages/:messageId", async (req, res) => {
      const { boardId, messageId } = req.params;
      const { deletedBy, deletedAt } = req.body;
    
      if (!ObjectId.isValid(boardId) || !ObjectId.isValid(messageId)) {
        return res.status(400).send({ error: "Invalid board or message ID" });
      }
    
      try {
        const result = await boardCollection.updateOne(
          { _id: new ObjectId(boardId), "messages.messageId": new ObjectId(messageId) },
          {
            $set: {
              "messages.$.text": null,
              "messages.$.deletedBy": deletedBy,
              "messages.$.deletedAt": deletedAt,
            },
          }
        );
    
        if (result.matchedCount === 0) {
          return res.status(404).send({ error: "Message not found" });
        }
    
        const updatedBoard = await boardCollection.findOne({ _id: new ObjectId(boardId) });
        const updatedMessage = updatedBoard.messages.find(
          (msg) => msg.messageId.toString() === messageId
        );
    
        res.send(updatedMessage);
      } catch (error) {
        console.error("Error deleting message:", error);
        res.status(500).send({ error: "Failed to delete message" });
      }
    });
    
    app.patch("/boards/:boardId/messages/:messageId/seen", async (req, res) => {
      const { boardId, messageId } = req.params;
      const { seenBy } = req.body;
    
      if (!ObjectId.isValid(boardId) || !ObjectId.isValid(messageId)) {
        return res.status(400).send({ error: "Invalid board or message ID" });
      }
    
      if (!seenBy || !ObjectId.isValid(seenBy)) {
        return res.status(400).send({ error: "Invalid seenBy user ID" });
      }
    
      try {
        const result = await boardCollection.updateOne(
          { _id: new ObjectId(boardId), "messages.messageId": new ObjectId(messageId) },
          { $addToSet: { "messages.$.seenBy": seenBy } } // Ensure unique user IDs in seenBy array
        );
    
        if (result.matchedCount === 0) {
          return res.status(404).send({ error: "Message not found" });
        }
    
        const updatedBoard = await boardCollection.findOne({ _id: new ObjectId(boardId) });
        const updatedMessage = updatedBoard.messages.find(
          (msg) => msg.messageId.toString() === messageId
        );
    
        res.send(updatedMessage);
      } catch (error) {
        console.error("Error marking message as seen:", error);
        res.status(500).send({ error: "Failed to mark message as seen" });
      }
    });

    app.patch("/boards/:boardId/messages/:messageId/react", async (req, res) => {
      const { boardId, messageId } = req.params;
      const { userId, reaction } = req.body;
    
      if (!ObjectId.isValid(boardId) || !ObjectId.isValid(messageId)) {
        return res.status(400).send({ error: "Invalid board or message ID" });
      }
    
      try {
        const board = await boardCollection.findOne({ _id: new ObjectId(boardId) });
        if (!board) {
          return res.status(404).send({ error: "Board not found" });
        }
    
        const message = board.messages.find(
          (msg) => msg.messageId.toString() === messageId
        );
        if (!message) {
          return res.status(404).send({ error: "Message not found" });
        }
    
        // Ensure the reactions object is initialized
        if (!message.reactions) {
          message.reactions = {};
        }
    
        const userHasReacted = message.reactions[reaction]?.includes(userId);
    
        if (userHasReacted) {
          // Remove the user's reaction
          await boardCollection.updateOne(
            { _id: new ObjectId(boardId), "messages.messageId": new ObjectId(messageId) },
            { $pull: { [`messages.$.reactions.${reaction}`]: userId } }
          );
        } else {
          // Add the user's reaction
          await boardCollection.updateOne(
            { _id: new ObjectId(boardId), "messages.messageId": new ObjectId(messageId) },
            { $addToSet: { [`messages.$.reactions.${reaction}`]: userId } }
          );
        }
    
        const updatedBoard = await boardCollection.findOne({ _id: new ObjectId(boardId) });
        const updatedMessage = updatedBoard.messages.find(
          (msg) => msg.messageId.toString() === messageId
        );
    
        res.send(updatedMessage);
      } catch (error) {
        console.error("Error updating reaction:", error);
        res.status(500).send({ error: "Failed to update reaction" });
      }
    });
    
    app.patch("/boards/:boardId/messages/:messageId/pin", async (req, res) => {
      const { boardId, messageId } = req.params;
      const { pinnedBy, pinDuration } = req.body;
    
      if (!ObjectId.isValid(boardId) || !ObjectId.isValid(messageId)) {
        return res.status(400).send({ error: "Invalid board or message ID" });
      }
    
      try {
        const pinExpiry = new Date();
        pinExpiry.setDate(pinExpiry.getDate() + pinDuration);
    
        const result = await boardCollection.updateOne(
          { _id: new ObjectId(boardId), "messages.messageId": new ObjectId(messageId) },
          {
            $set: {
              "messages.$.pinnedBy": pinnedBy,
              "messages.$.pinExpiry": pinExpiry.toISOString(),
            },
          }
        );
    
        if (result.matchedCount === 0) {
          return res.status(404).send({ error: "Message not found" });
        }
    
        const updatedBoard = await boardCollection.findOne({ _id: new ObjectId(boardId) });
        const updatedMessage = updatedBoard.messages.find(
          (msg) => msg.messageId.toString() === messageId
        );
    
        res.send(updatedMessage);
      } catch (error) {
        console.error("Error pinning message:", error);
        res.status(500).send({ error: "Failed to pin message" });
      }
    });
    
    app.patch("/boards/:boardId/messages/:messageId/unpin", async (req, res) => {
      const { boardId, messageId } = req.params;
    
      if (!ObjectId.isValid(boardId) || !ObjectId.isValid(messageId)) {
        return res.status(400).send({ error: "Invalid board or message ID" });
      }
    
      try {
        const result = await boardCollection.updateOne(
          { _id: new ObjectId(boardId), "messages.messageId": new ObjectId(messageId) },
          {
            $unset: {
              "messages.$.pinnedBy": "",
              "messages.$.pinExpiry": "",
            },
          }
        );
    
        if (result.matchedCount === 0) {
          return res.status(404).send({ error: "Message not found" });
        }
    
        res.send({ message: "Message unpinned successfully" });
      } catch (error) {
        console.error("Error unpinning message:", error);
        res.status(500).send({ error: "Failed to unpin message" });
      }
    });
    
     app.delete("/boards/:id", async (req, res) => {
      const { id } = req.params;
    
      try {
        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ error: "Invalid board ID" });
        }
    
        const result = await boardCollection.deleteOne({ _id: new ObjectId(id) });
    
        if (result.deletedCount === 0) {
          return res.status(404).send({ error: "Board not found" });
        }
    
        res.send({ message: "Board deleted successfully" });
      } catch (error) {
        console.error("Error deleting board:", error);
        res.status(500).send({ error: "Failed to delete board" });
      }
    });

    // task management board

    //  column related apis 
    app.get("/columns", async (req, res) => {
      console.log("hit the column get");
      const result = await columnCollection.find().sort({ order: 1 }).toArray();
      res.send(result);
    })
    app.post("/columns", async (req, res) => {
      console.log("hit the columns post api")
      const column = req.body;
      const newColumns = { ...column }
      const result = await columnCollection.insertOne(newColumns);
      res.send(result);
    })

    app.put("/columns", async (req, res) => {
      console.log("hit the columns put api");
      const columnSet = req.body;
      console.log("columnSet:", columnSet)
      const updateOperations = columnSet.map((column, index) => {
        const { _id, ...columnData } = column;
        columnCollection.updateOne(
          { id: column.id },
          { $set: { ...columnData, order: index } },
          { upsert: true }
        )
      });
      await Promise.all(updateOperations);

      res.send({ message: "Tasks updated" });

    });

    app.put("/columnName", async (req, res) => {
      const { id, tittle } = req.body;
      console.log("Column Name update")
      const query = {
        id: id
      };
      const updateInfo = {
        $set: {
          tittle: tittle
        }
      }
      const result = await columnCollection.updateOne(query, updateInfo);
      res.send(result)

    })

    app.delete("/columns",async(req,res)=>{
      const columnId=req.query.id;
      const result1=await taskCollection.deleteMany({columnId:columnId})
      const result=await columnCollection.deleteOne({id:columnId});
      res.send(result)
    })


    // task related apis
    app.get("/tasks", async (req, res) => {
      const result = await taskCollection.find().sort({ order: 1 }).toArray();
      res.send(result);
    })
    app.post("/tasks", async (req, res) => {
      const task = req.body;
      const newTask = { ...task }
      const result = await taskCollection.insertOne(newTask);
      res.send(result);
    })
    app.put("/tasks", async (req, res) => {
      console.log("hit the task put api");
      const taskSet = req.body;
      console.log("taskSet:", taskSet)
      const updateOperations = taskSet.map((task, index) => {
        const { _id, ...taskData } = task;
        taskCollection.updateOne(
          { id: task.id },
          { $set: { ...taskData, order: index } },
          { upsert: true }
        )
      });
      await Promise.all(updateOperations);

      res.send({ message: "Tasks updated" });

    })

    app.post("/boards/:boardId/polls", async (req, res) => {
      const { boardId } = req.params;
      const { question, options, createdBy } = req.body;
    
      if (!ObjectId.isValid(boardId)) {
        return res.status(400).send({ error: "Invalid board ID" });
      }
    
      try {
        const board = await boardCollection.findOne({ _id: new ObjectId(boardId) });
        if (!board) {
          return res.status(404).send({ error: "Board not found" });
        }
    
        // Check if the user has already created a poll in the last 24 hours
        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const recentPoll = board.polls?.find(
          (poll) => poll.createdBy === createdBy && new Date(poll.createdAt) > oneDayAgo
        );
    
        if (recentPoll) {
          return res.status(400).send({ error: "You can only create one poll per day." });
        }
    
        const poll = {
          _id: new ObjectId(),
          question,
          options,
          createdBy,
          createdAt: now.toISOString(),
          expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(), // Set expiration time to 24 hours
          isActive: true,
        };
    
        const result = await boardCollection.updateOne(
          { _id: new ObjectId(boardId) },
          { $push: { polls: poll } }
        );
    
        if (result.matchedCount === 0) {
          return res.status(404).send({ error: "Board not found" });
        }
    
        res.status(201).send(poll);
      } catch (error) {
        console.error("Error creating poll:", error);
        res.status(500).send({ error: "Failed to create poll" });
      }
    });
    
    app.get("/boards/:boardId/polls", async (req, res) => {
      const { boardId } = req.params;
    
      if (!ObjectId.isValid(boardId)) {
        return res.status(400).send({ error: "Invalid board ID" });
      }
    
      try {
        const board = await boardCollection.findOne({ _id: new ObjectId(boardId) });
        if (!board) {
          return res.status(404).send({ error: "Board not found" });
        }
    
        // Automatically deactivate expired polls
        const now = new Date();
        const updatedPolls = board.polls.map((poll) => {
          if (new Date(poll.expiresAt) <= now) {
            return { ...poll, isActive: false };
          }
          return poll;
        });
    
        // Update the board with the deactivated polls
        await boardCollection.updateOne(
          { _id: new ObjectId(boardId) },
          { $set: { polls: updatedPolls } }
        );
    
        res.send(updatedPolls);
      } catch (error) {
        console.error("Error fetching polls:", error);
        res.status(500).send({ error: "Failed to fetch polls" });
      }
    });
    
    app.patch("/boards/:boardId/polls/:pollId/vote", async (req, res) => {
      const { boardId, pollId } = req.params;
      const { userId, optionIndex } = req.body;
    
      if (!ObjectId.isValid(boardId) || !ObjectId.isValid(pollId)) {
        return res.status(400).send({ error: "Invalid board or poll ID" });
      }
    
      try {
        const board = await boardCollection.findOne({ _id: new ObjectId(boardId) });
        if (!board) {
          return res.status(404).send({ error: "Board not found" });
        }
    
        const poll = board.polls.find((p) => p._id.toString() === pollId);
        if (!poll) {
          return res.status(404).send({ error: "Poll not found" });
        }
    
        if (poll.options[optionIndex].votes.includes(userId)) {
          return res.status(400).send({ error: "User has already voted" });
        }
    
        poll.options[optionIndex].votes.push(userId);
    
        await boardCollection.updateOne(
          { _id: new ObjectId(boardId), "polls._id": new ObjectId(pollId) },
          { $set: { "polls.$": poll } }
        );
    
        res.send(poll);
      } catch (error) {
        console.error("Error voting on poll:", error);
        res.status(500).send({ error: "Failed to vote on poll" });
      }
    });
    
    app.delete("/boards/:boardId/polls/:pollId", async (req, res) => {
      const { boardId, pollId } = req.params;

      if (!ObjectId.isValid(boardId) || !ObjectId.isValid(pollId)) {
        return res.status(400).send({ error: "Invalid board or poll ID" });
      }

      try {
        const result = await boardCollection.updateOne(
          { _id: new ObjectId(boardId) },
          { $pull: { polls: { _id: new ObjectId(pollId) } } } // Remove the poll
        );

        if (result.modifiedCount === 0) {
          return res.status(404).send({ error: "Poll not found" });
        }

        res.send({ message: "Poll removed successfully" });
      } catch (error) {
        console.error("Error removing poll:", error);
        res.status(500).send({ error: "Failed to remove poll" });
      }
    });
    
  } finally {
    // Ensure the client connection is properly closed if needed
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send(" Brainiacs Server is running in Brain");
});

app.listen(port, () => {
  console.log(`server is running properly at : ${port}`);
});
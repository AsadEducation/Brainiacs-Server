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
      "https://brainiacs1.netlify.app",
      "https://brainiacs-team-collaboration.vercel.app",
      //deploy link ta ekhane boshayen please
      //na hoy may error dite pare.
    ],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"], // Allow specific HTTP methods
    allowedHeaders: ["Content-Type", "Authorization"], // Allow specific headers
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
    const userCollection = database.collection("users");
    const columnCollection = database.collection("Columns");
    const taskCollection = database.collection("Tasks");
    const boardCollection = database.collection("boards");
    const rewardCollection = database.collection("rewards");
    const myProfileCollection = database.collection("myProfile");
    const activityCollection = database.collection("activity");
    const completedTask = database.collection("completedTask");
    const leaderboardCollection = database.collection("leaderboard");

    // completed task
    app.get("/completedTask/:email", async (req, res) => {
      const userEmail = req.params.email;

      try {
        const result = await completedTask.find({ email: userEmail }).toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching completed tasks:", error);
        res
          .status(500)
          .send({ success: false, message: "Internal server error." });
      }
    });

    app.post("/completedTask", async (req, res) => {
      const taskData = req.body;

      try {
        const result = await completedTask.insertOne(taskData);
        res.send({
          success: true,
          message: "Task marked as completed!",
          result,
        });
      } catch (error) {
        console.error("Error inserting completed task:", error);
        res
          .status(500)
          .send({ success: false, message: "Internal server error." });
      }
    });

    //my profile
    app.get("/myProfile", async (req, res) => {
      try {
        const userEmail = req.query.email;
        if (!userEmail) {
          return res.status(400).send({ message: "Email is required" });
        }

        const completedTask = client
          .db("Brainiacs")
          .collection("completedTask");
        const rewardCollection = database.collection("rewards");
        const myProfileCollection = client
          .db("Brainiacs")
          .collection("myProfile");

        // Step 1: Get this user's completed tasks
        const userCompletedTasks = await completedTask
          .find({ email: userEmail })
          .toArray();
        const completedCount = userCompletedTasks.length;
        const points = completedCount * 10;

        // Step 2: Get reward data
        const rewardData = await rewardCollection.find().toArray();

        // Step 3: Badge logic
        const unlockedBadges = rewardData.filter(
          (b) => points >= b.pointsRequired
        );
        const lockedBadges = rewardData.filter(
          (b) => points < b.pointsRequired
        );

        const currentBadge = unlockedBadges[unlockedBadges.length - 1] || null;
        const nextBadge = lockedBadges[0] || null;

        const progressToNext = nextBadge
          ? Math.floor((points / nextBadge.pointsRequired) * 100)
          : 100;

        // Step 4: Prepare profile summary
        const summary = {
          email: userEmail,
          points,
          completedCount,
          currentBadge,
          nextBadge,
          progressToNext,
          badges: rewardData,
        };

        // Step 5: Save to DB
        await myProfileCollection.updateOne(
          { email: userEmail },
          { $set: summary },
          { upsert: true }
        );

        res.send(summary);
      } catch (error) {
        console.error("GET /myProfile error", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    app.post("/myProfile", async (req, res) => {
      try {
        const profileData = req.body;

        if (!profileData?.email) {
          return res.status(400).send({ message: "Email is required" });
        }

        const result = await myProfileCollection.updateOne(
          { email: profileData.email },
          { $set: profileData },
          { upsert: true }
        );

        res.send({ message: "Profile saved", result });
      } catch (error) {
        console.error("POST /myProfile error", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    // leaderboard right code
    app.get("/leaderboard", async (req, res) => {
      try {
        const leaderboard = await leaderboardCollection
          .find()
          .sort({ points: -1 })
          .toArray();
        res.send(leaderboard);
      } catch (err) {
        res.status(500).send({ message: "Failed to load leaderboard" });
      }
    });

    app.post("/leaderboard", async (req, res) => {
      try {
        const users = await userCollection.find().toArray();
        const completedTasks = await completedTask.find().toArray();
        const rewards = await rewardCollection.find().toArray();

        const leaderboard = users.map((user) => {
          const userCompleted = completedTasks.filter(
            (t) => t.email === user.email
          );
          const points = userCompleted.length * 10;
          const badge = rewards
            .filter((b) => points >= b.pointsRequired)
            .sort((a, b) => b.pointsRequired - a.pointsRequired)[0];

          return {
            name: user.name,
            email: user.email,
            avatar: user.photoURL,
            points,
            badge: badge?.title || "No Badge",
            badgeImage: badge?.image || null,
            updatedAt: new Date(),
          };
        });

        await leaderboardCollection.deleteMany({});
        await leaderboardCollection.insertMany(leaderboard);

        res.send({ message: "Leaderboard updated successfully" });
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Failed to update leaderboard" });
      }
    });

    // leaderboard
    // app.get('/leaderboard', async (req, res) => {
    //   try {
    //     const users = await userCollection.find().toArray();
    //     const completedTasks = await completedTask.find().toArray();
    //     const rewards = await rewardCollection.find().toArray();

    //     // count points per user
    //     const leaderboard = users.map(user => {
    //     const userCompletedTasks = completedTasks.filter(task => task.email === user.email);
    //     const points = userCompletedTasks.length * 10;

    //       // find the badge based on points
    //       const earnedBadge = rewards
    //         .filter(badge => points >= badge.pointsRequired)
    //         .sort((a, b) => b.pointsRequired - a.pointsRequired)[0];

    //       return {
    //         name: user.name,
    //         email: user.email,
    //         avatar: user.photoURL,
    //         points: points,
    //         badge: earnedBadge ? earnedBadge.title : "No Badge",
    //         badgeImage: earnedBadge ? earnedBadge.image : null,
    //       };
    //     });

    //     leaderboard.sort((a, b) => b.points - a.points);

    //     res.send(leaderboard);
    //   } catch (error) {
    //     console.error(error);
    //     res.status(500).send({ message: "Server Error" });
    //   }
    // });

    //user collection is empty now
    // user related api
    app.get("/users", async (req, res) => {
      try {
        const users = await userCollection.find().toArray();

        // Transform photo to photoURL in the response
        const transformedUsers = users.map((user) => {
          if (user.photo) {
            user.photoURL = user.photo;
            delete user.photo;
          }
          return user;
        });

        res.send(transformedUsers);
      } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).send({ error: "Failed to fetch users" });
      }
    });

    app.post("/users", async (req, res) => {
      const newUser = req.body;

      // Validation
      if (!newUser.displayName || !newUser.email || !newUser._id) {
        return res
          .status(400)
          .send({ error: "User _id, displayName, and email are required" });
      }

      try {
        // Check if the user already exists
        const existingUser = await userCollection.findOne({
          email: newUser.email.trim(),
        });
        if (existingUser) {
          return res.status(200).send({ message: "User already exists" }); // Return 200 with a message
        }

        // Save the user
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
        return res
          .status(400)
          .send({ error: "Authorization token is required" });
      }

      const token = authHeader.split(" ")[1]; // Extract the token
      try {
        const email = decodeURIComponent(req.query.email); // Decode the email
        if (!email) {
          return res
            .status(400)
            .send({ error: "Email query parameter is required" });
        }

        console.log(`Fetching user with email: ${email.trim()}`); // Log email being queried
        const user = await userCollection.findOne({ email: email.trim() });

        if (!user) {
          console.warn(`User not found for email: ${email.trim()}`); // Log if user is not found
          return res.status(404).send({ error: "User not found" });
        }

        // Transform photo to photoURL in the response
        if (user.photo) {
          user.photoURL = user.photo;
          delete user.photo;
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

        const user = await userCollection.findOne({ email: email.trim() }); // Ensure trimmed email
        if (!user) {
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

    // Member search API
    app.get("/members/search", async (req, res) => {
      const { query } = req.query;

      if (!query) {
        return res.status(400).send({ error: "Query parameter is required" });
      }

      try {
        const regex = new RegExp(query, "i"); // Case-insensitive search
        const users = await userCollection
          .find({
            $or: [
              { name: regex }, // Match name
              { email: regex }, // Match email
            ],
          })
          .limit(10) // Limit results to 10
          .toArray();

        res.send(users);
      } catch (error) {
        console.error("Error searching members:", error);
        res.status(500).send({ error: "Failed to search members" });
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

      try {
        if (!ObjectId.isValid(id)) {
          return res.status(400).json({ error: "Invalid board ID" });
        }

        const board = await boardCollection.findOne({ _id: new ObjectId(id) });

        if (!board) {
          return res.status(404).json({ error: "Board not found" });
        }

        // Validate and filter valid userIds
        const validMemberIds = board.members
          ?.map((member) =>
            ObjectId.isValid(member.userId) ? new ObjectId(member.userId) : null
          )
          .filter((id) => id !== null);

        // Populate member details if valid userIds exist
        const memberDetails = validMemberIds.length
          ? await userCollection
              .find({ _id: { $in: validMemberIds } })
              .toArray()
          : [];

        const populatedMembers =
          board.members?.map((member) => {
            const user = memberDetails.find(
              (user) => user._id.toString() === member.userId
            );
            return {
              ...member,
              name: member?.displayName,
              email: member?.email,
              photoURL: member?.photoURL,
              role: member.role || "member",
            };
          }) || [];

        res.json({
          ...board,
          members: populatedMembers,
        });
      } catch (error) {
        console.error("Error fetching board:", error);
        res.status(500).json({ error: "Failed to fetch board" });
      }
    });

    app.post("/boards", async (req, res) => {
      const { name, description, visibility, theme, createdBy } = req.body;

      if (!name) {
        return res.status(400).send({ error: "Board name is required" });
      }

      if (!createdBy || typeof createdBy !== "string") {
        return res.status(400).send({
          error: "Invalid User ID (createdBy)",
          details: "Please provide a valid string for createdBy",
        });
      }

      try {
        const creator = await userCollection.findOne({ _id: createdBy });
        if (!creator) {
          return res.status(404).send({
            error: "Creator not found",
            details: `No user found with ID: ${createdBy}`,
          });
        }

        const newBoard = {
          name,
          description: description || "",
          visibility: visibility || "Public",
          theme: theme || "#3b82f6",
          createdBy,
          members: [
            {
              userId: createdBy,
              name: creator.displayName,
              email: creator.email,
              photoURL: creator.photoURL,
              role: "admin",
            },
          ],
          createdAt: new Date().toISOString(),
        };

        const result = await boardCollection.insertOne(newBoard);
        res.status(201).send(result);
      } catch (error) {
        console.error("Error creating board:", error);
        res.status(500).send({ error: "Failed to create board" });
      }
    });
    app.put("/boards/:id", async (req, res) => {
      const { id } = req.params;
      const { name, description, visibility, theme, members } = req.body;

      if (!ObjectId.isValid(id)) {
        return res.status(400).send({ error: "Invalid board ID" });
      }

      try {
        const updateFields = {};
        if (name !== undefined) updateFields.name = name;
        if (description !== undefined) updateFields.description = description;
        if (visibility !== undefined) updateFields.visibility = visibility;
        if (theme !== undefined) updateFields.theme = theme;

        if (members !== undefined) {
          // Get current board to preserve existing members
          const currentBoard = await boardCollection.findOne({
            _id: new ObjectId(id),
          });

          const currentMembers = currentBoard?.members || [];

          // Create a map of existing members for quick lookup
          const existingMembersMap = new Map(
            currentMembers.map((member) => [member.userId, member])
          );

          // Process new members
          const newMembers = await Promise.all(
            members.map(async (member) => {
              if (!ObjectId.isValid(member.userId)) {
                console.warn(`Invalid userId: ${member.userId}`);
                return null;
              }

              const user = await userCollection.findOne({
                _id: new ObjectId(member.userId),
              });

              if (!user) return null;

              return {
                userId: member.userId,
                email: user.email,
                photoURL: user.photoURL,
                name: user.name || user.displayName,
                role: member.role || "member",
              };
            })
          );

          // Filter out nulls and merge with existing members
          const validNewMembers = newMembers.filter((m) => m !== null);
          const updatedMembers = [...currentMembers];

          validNewMembers.forEach((newMember) => {
            if (!existingMembersMap.has(newMember.userId)) {
              updatedMembers.push(newMember);
            }
          });

          updateFields.members = updatedMembers;
        }

        const result = await boardCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updateFields }
        );

        if (result.matchedCount === 0) {
          return res.status(404).send({ error: "Board not found" });
        }

        res.send({
          message: "Board updated successfully",
          updatedMembers: updateFields.members || [],
        });
      } catch (error) {
        console.error("Error updating board:", error);
        res.status(500).send({ error: "Failed to update board" });
      }
    });
    app.put("/boards/:id/messages", async (req, res) => {
      const { id } = req.params;
      const { senderId, senderName, role, text, attachments } = req.body;

      // Log the incoming payload for debugging
      console.log("Incoming message payload:", req.body);

      // Validation (updated)
      if (!ObjectId.isValid(id)) {
        return res.status(400).send({ error: "Invalid board ID" });
      }
      if (!senderId) {
        return res.status(400).send({ error: "Sender ID is required" });
      }
      if (!role || typeof role !== "string") {
        return res
          .status(400)
          .send({ error: "Role is required and must be a string" });
      }
      if (!text?.trim() && (!attachments || attachments.length === 0)) {
        return res.status(400).send({
          error: "Either text or attachment is required",
        });
      }

      try {
        const board = await boardCollection.findOne({ _id: new ObjectId(id) });
        if (!board) {
          return res.status(404).send({ error: "Board not found" });
        }

        const message = {
          messageId: new ObjectId(), // Unique ID for the message
          senderId: ObjectId.isValid(senderId)
            ? new ObjectId(senderId)
            : senderId, // Convert to ObjectId if valid
          senderName,
          role,
          text: text?.trim() || null,
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
          {
            _id: new ObjectId(boardId),
            "messages.messageId": new ObjectId(messageId),
          }, // Convert messageId to ObjectId
          { $set: { "messages.$.text": text } }
        );

        if (result.matchedCount === 0) {
          return res.status(404).send({ error: "Message not found" });
        }

        const updatedBoard = await boardCollection.findOne({
          _id: new ObjectId(boardId),
        });
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
          {
            _id: new ObjectId(boardId),
            "messages.messageId": new ObjectId(messageId),
          },
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

        const updatedBoard = await boardCollection.findOne({
          _id: new ObjectId(boardId),
        });
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

      if (!seenBy) {
        return res.status(400).send({ error: "seenBy user ID is required" });
      }

      // Validate seenBy as a valid ObjectId or string
      const seenById = ObjectId.isValid(seenBy) ? new ObjectId(seenBy) : seenBy;

      try {
        const result = await boardCollection.updateOne(
          {
            _id: new ObjectId(boardId),
            "messages.messageId": new ObjectId(messageId),
          },
          { $addToSet: { "messages.$.seenBy": seenById } } // Add seenBy as a string or ObjectId
        );

        if (result.matchedCount === 0) {
          return res.status(404).send({ error: "Message not found" });
        }

        const updatedBoard = await boardCollection.findOne({
          _id: new ObjectId(boardId),
        });
        const updatedMessage = updatedBoard.messages.find(
          (msg) => msg.messageId.toString() === messageId
        );

        res.send(updatedMessage);
      } catch (error) {
        console.error("Error marking message as seen:", error);
        res.status(500).send({ error: "Failed to mark message as seen" });
      }
    });

    app.patch(
      "/boards/:boardId/messages/:messageId/react",
      async (req, res) => {
        const { boardId, messageId } = req.params;
        const { userId, reaction } = req.body;

        if (!ObjectId.isValid(boardId) || !ObjectId.isValid(messageId)) {
          return res.status(400).send({ error: "Invalid board or message ID" });
        }

        try {
          const board = await boardCollection.findOne({
            _id: new ObjectId(boardId),
          });
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

          // Remove the user's previous reaction
          for (const [emoji, users] of Object.entries(message.reactions)) {
            if (users.includes(userId)) {
              message.reactions[emoji] = users.filter((id) => id !== userId);
              if (message.reactions[emoji].length === 0) {
                delete message.reactions[emoji]; // Remove empty reaction
              }
            }
          }

          // Add the new reaction if it's not a removal
          if (reaction) {
            if (!message.reactions[reaction]) {
              message.reactions[reaction] = [];
            }
            message.reactions[reaction].push(userId);
          }

          // Update the message in the database
          await boardCollection.updateOne(
            {
              _id: new ObjectId(boardId),
              "messages.messageId": new ObjectId(messageId),
            },
            { $set: { "messages.$.reactions": message.reactions } }
          );

          res.send(message);
        } catch (error) {
          console.error("Error updating reaction:", error);
          res.status(500).send({ error: "Failed to update reaction" });
        }
      }
    );

    app.delete(
      "/boards/:boardId/messages/:messageId/reactions/:emoji",
      async (req, res) => {
        const { boardId, messageId, emoji } = req.params;
        const { userId } = req.body;

        if (!ObjectId.isValid(boardId) || !ObjectId.isValid(messageId)) {
          return res.status(400).send({ error: "Invalid board or message ID" });
        }

        try {
          const result = await boardCollection.updateOne(
            {
              _id: new ObjectId(boardId),
              "messages.messageId": new ObjectId(messageId),
            },
            { $pull: { [`messages.$.reactions.${emoji}`]: userId } }
          );

          if (result.matchedCount === 0) {
            return res.status(404).send({ error: "Reaction not found" });
          }

          // Remove the emoji key if no users remain
          await boardCollection.updateOne(
            {
              _id: new ObjectId(boardId),
              "messages.messageId": new ObjectId(messageId),
            },
            { $unset: { [`messages.$.reactions.${emoji}`]: "" } }
          );

          res.send({ message: "Reaction removed successfully" });
        } catch (error) {
          console.error("Error removing reaction:", error);
          res.status(500).send({ error: "Failed to remove reaction" });
        }
      }
    );

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
          {
            _id: new ObjectId(boardId),
            "messages.messageId": new ObjectId(messageId),
          },
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

        const updatedBoard = await boardCollection.findOne({
          _id: new ObjectId(boardId),
        });
        const updatedMessage = updatedBoard.messages.find(
          (msg) => msg.messageId.toString() === messageId
        );

        res.send(updatedMessage);
      } catch (error) {
        console.error("Error pinning message:", error);
        res.status(500).send({ error: "Failed to pin message" });
      }
    });

    app.patch(
      "/boards/:boardId/messages/:messageId/unpin",
      async (req, res) => {
        const { boardId, messageId } = req.params;

        if (!ObjectId.isValid(boardId) || !ObjectId.isValid(messageId)) {
          return res.status(400).send({ error: "Invalid board or message ID" });
        }

        try {
          const result = await boardCollection.updateOne(
            {
              _id: new ObjectId(boardId),
              "messages.messageId": new ObjectId(messageId),
            },
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
      }
    );

    app.delete("/boards/:id", async (req, res) => {
      const { id } = req.params;

      try {
        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ error: "Invalid board ID" });
        }

        const result = await boardCollection.deleteOne({
          _id: new ObjectId(id),
        });

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
    });
    app.post("/columns", async (req, res) => {
      console.log("hit the columns post api");
      const column = req.body;
      const newColumns = { ...column };
      const result = await columnCollection.insertOne(newColumns);
      res.send(result);
    });

    app.put("/columns", async (req, res) => {
      console.log("hit the columns put api");
      const columnSet = req.body;
      console.log("columnSet:", columnSet);
      const updateOperations = columnSet.map((column, index) => {
        const { _id, ...columnData } = column;
        columnCollection.updateOne(
          { id: column.id },
          { $set: { ...columnData, order: index } },
          { upsert: true }
        );
      });
      await Promise.all(updateOperations);

      res.send({ message: "Tasks updated" });
    });

    app.put("/columnName", async (req, res) => {
      const { id, tittle } = req.body;
      console.log("Column Name update");
      const query = {
        id: id,
      };
      const updateInfo = {
        $set: {
          tittle: tittle,
        },
      };
      const result = await columnCollection.updateOne(query, updateInfo);
      res.send(result);
    });

    app.delete("/columns", async (req, res) => {
      const columnId = req.query.id;
      const result1 = await taskCollection.deleteMany({ columnId: columnId });
      const result = await columnCollection.deleteOne({ id: columnId });
      res.send(result);
    });

    // task related apis
    app.get("/tasks", async (req, res) => {
      const result = await taskCollection.find().sort({ order: 1 }).toArray();
      res.send(result);
    });
    app.post("/tasks", async (req, res) => {
      const task = req.body;
      const newTask = { ...task };
      const result = await taskCollection.insertOne(newTask);
      res.send(result);
    });
    app.put("/tasks", async (req, res) => {
      console.log("hit the task put api");
      const taskSet = req.body;
      console.log("taskSet:", taskSet);
      const updateOperations = taskSet.map((task, index) => {
        const { _id, ...taskData } = task;
        taskCollection.updateOne(
          { id: task.id },
          { $set: { ...taskData, order: index } },
          { upsert: true }
        );
      });
      await Promise.all(updateOperations);

      res.send({ message: "Tasks updated" });
    });

    app.post("/boards/:boardId/polls", async (req, res) => {
      const { boardId } = req.params;
      const { question, options, createdBy } = req.body;

      if (!ObjectId.isValid(boardId)) {
        return res.status(400).send({ error: "Invalid board ID" });
      }

      try {
        const board = await boardCollection.findOne({
          _id: new ObjectId(boardId),
        });
        if (!board) {
          return res.status(404).send({ error: "Board not found" });
        }

        // Check if the user has already created a poll in the last 24 hours
        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const recentPoll = board.polls?.find(
          (poll) =>
            poll.createdBy === createdBy && new Date(poll.createdAt) > oneDayAgo
        );

        if (recentPoll) {
          return res
            .status(400)
            .send({ error: "You can only create one poll per day." });
        }

        const poll = {
          _id: new ObjectId(),
          question,
          options,
          createdBy,
          createdAt: now.toISOString(),
          expiresAt: new Date(
            now.getTime() + 24 * 60 * 60 * 1000
          ).toISOString(), // Set expiration time to 24 hours
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
        const board = await boardCollection.findOne({
          _id: new ObjectId(boardId),
        });
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

      // Validate IDs
      if (!ObjectId.isValid(boardId) || !ObjectId.isValid(pollId)) {
        return res.status(400).send({ error: "Invalid board or poll ID" });
      }

      try {
        // 1. Fetch the board and poll
        const board = await boardCollection.findOne({
          _id: new ObjectId(boardId),
        });
        if (!board) return res.status(404).send({ error: "Board not found" });

        const poll = board.polls.find((p) => p._id.toString() === pollId);
        if (!poll) return res.status(404).send({ error: "Poll not found" });

        // 2. Check if user already voted on the specific option
        const hasVotedOnOption = poll.options[optionIndex].votes.some(
          (vote) => vote.userId === userId
        );
        if (hasVotedOnOption) {
          return res
            .status(400)
            .send({ error: "User already voted on this option" });
        }

        // 3. Fetch user details from userCollection
        const user = await userCollection.findOne({
          _id: new ObjectId(userId),
        });
        if (!user) return res.status(404).send({ error: "User not found" });

        // 4. Add vote with user details
        const voteData = {
          userId,
          name: user.name,
          email: user.email,
          photoURL: user.photoURL, // Include user's profile photo if available
        };

        // Add the vote to the specified option
        poll.options[optionIndex].votes.push(voteData);

        // 5. Update the poll in the database
        await boardCollection.updateOne(
          { _id: new ObjectId(boardId), "polls._id": new ObjectId(pollId) },
          { $set: { "polls.$": poll } }
        );

        res.send(poll);
      } catch (error) {
        console.error("Error voting on poll:", error);
        res.status(500).send({ error: "Failed to process vote" });
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

    app.patch(
      "/boards/:boardId/polls/:pollId/remove-vote",
      async (req, res) => {
        const { boardId, pollId } = req.params;
        const { userId, optionIndex } = req.body;

        if (!ObjectId.isValid(boardId) || !ObjectId.isValid(pollId)) {
          return res.status(400).send({ error: "Invalid board or poll ID" });
        }

        try {
          // Fetch the board and poll
          const board = await boardCollection.findOne({
            _id: new ObjectId(boardId),
          });
          if (!board) return res.status(404).send({ error: "Board not found" });

          const poll = board.polls.find((p) => p._id.toString() === pollId);
          if (!poll) return res.status(404).send({ error: "Poll not found" });

          // Check if the user has voted on the specific option
          const optionVotes = poll.options[optionIndex].votes;
          const voteIndex = optionVotes.findIndex(
            (vote) => vote.userId === userId
          );
          if (voteIndex === -1) {
            return res
              .status(400)
              .send({ error: "User has not voted on this option" });
          }

          // Remove the user's vote
          optionVotes.splice(voteIndex, 1);

          // Update the poll in the database
          await boardCollection.updateOne(
            { _id: new ObjectId(boardId), "polls._id": new ObjectId(pollId) },
            { $set: { "polls.$": poll } }
          );

          res.send(poll);
        } catch (error) {
          console.error("Error removing vote from poll:", error);
          res.status(500).send({ error: "Failed to remove vote from poll" });
        }
      }
    );

    // activity related api

    app.get("/activity", async (req, res) => {
      const email = req.query?.email; console.log('activity email', email);

      let query = {};

      if (email && email !== "undefined") {
        query.currentUser ={email}
      }

      else return;

      const result = await activityCollection.find(query).toArray(); console.log(result);

      res.send(result);
    });

    app.post("/activity", async (req, res) => {
      const activityObject = req?.body;
      const result = await activityCollection.insertOne(activityObject);
      res.send(result);
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

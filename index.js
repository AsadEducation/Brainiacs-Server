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
    // <<<<<<< HEAD
    // =======

    // >>>>>>> 9d5ac285497d18596787dd97c26bf8e7ddf5a3e6

    const database = client.db("Brainiacs");
    const userCollection = client.db("Brainiacs").collection("users");
    const columnCollection = database.collection("Columns");
    const taskCollection = database.collection("Tasks");
    const boardCollection = client.db("Brainiacs").collection("boards");

    app.get("/users", async (req, res) => {
      const cursor = userCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    app.post("/users", async (req, res) => {
      const newUser = req.body;
      if (!newUser.role) {
        newUser.role = "user";
      }
      const result = await userCollection.insertOne(newUser);
      res.send(result);
    });

    app.get("/user", async (req, res) => {
      const email = req.query.email;
      if (!email) {
        return res.status(400).send({ error: "Email query parameter is required" });
      }
      const user = await userCollection.findOne({ email });
      if (user) {
        res.send(user);
      } else {
        res.status(404).send({ error: "User not found" });
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

      try {
        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ error: "Invalid board ID" });
        }

        const board = await boardCollection.findOne({ _id: new ObjectId(id) });

        if (!board) {
          return res.status(404).send({ error: "Board not found" });
        }

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
            role: member.role || "member", // Ensure role is preserved
          };
        });

        res.send({ ...board, members: populatedMembers });
      } catch (error) {
        res.status(500).send({ error: "Failed to fetch board" });
      }
    });

    app.post("/boards", async (req, res) => {
      const { name, visibility, theme, createdBy } = req.body;

      // Validation
      if (!name) {
        return res.status(400).send({ error: "Board name is required" });
      }
      if (!createdBy) {
        return res.status(400).send({ error: "createdBy is required" });
      }

      try {
        const createdAt = new Date().toISOString();

        // Basic board data without members
        const newBoard = {
          name,
          visibility: visibility || "Public",
          theme: theme || "#3b82f6",
          createdBy,
          members: [], // Initialize with an empty members array
          createdAt,
        };

        // Insert into the database
        const result = await boardCollection.insertOne(newBoard);

        // Respond to the client
        res.status(201).send({
          ...newBoard,
          _id: result.insertedId,
        });
      } catch (error) {
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

          // Validate each member's userId
          for (const member of members) {
            if (!member.userId || !ObjectId.isValid(member.userId)) {
              return res.status(400).send({ error: "Invalid userId in members array" });
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

    // <<<<<<< HEAD
    //     app.delete("/boards/:id", async (req, res) => {
    //       const { id } = req.params;

    //       try {
    //         if (!ObjectId.isValid(id)) {
    //           return res.status(400).send({ error: "Invalid board ID" });
    //         }

    //         const result = await boardCollection.deleteOne({ _id: new ObjectId(id) });

    //         if (result.deletedCount === 0) {
    //           return res.status(404).send({ error: "Board not found" });
    //         }
    //         res.send({ message: "Board deleted successfully" });
    //       } catch (error) {
    //         res.status(500).send({ error: "Failed to delete board" });
    //       }
    //     });

    // =======

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
      const newColumns = { ...column, order: column.length }
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


    // >>>>>>> 9d5ac285497d18596787dd97c26bf8e7ddf5a3e6
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

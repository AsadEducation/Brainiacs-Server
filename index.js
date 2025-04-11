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
    console.log("Pinged your deployment. You successfully connected to MongoDB!");


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




    //user collection is empty now
    // user related api 
    app.get("/users", async (req, res) => {
      const cursor = userCollection.find();
      const result = await cursor.toArray();
      console.log(result);
      res.send(result);
    });


    
    app.post("/users", async (req, res) => {
      const newUser = req.body;
      if (!newUser.role) {
        newUser.role = "user";
      }
      console.log("New User Data:", newUser);
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
        console.log("Fetched User:", user);
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
        console.error("Error searching users:", error);
        res.status(500).send({ error: "Failed to search users" });
      }
    });

    app.get("/boards", async (req, res) => {
      try {
        const boards = await boardCollection.find().toArray();
        res.send(boards);
      } catch (error) {
        console.error("Error fetching boards:", error);
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

        res.send(board);
      } catch (error) {
        console.error("Error fetching board:", error);
        res.status(500).send({ error: "Failed to fetch board" });
      }
    });

    app.post("/boards", async (req, res) => {
      const { name, visibility, theme, creator, members } = req.body;
      if (!name || !visibility || !creator) {
        return res.status(400).send({ error: "Board name, visibility, and creator are required" });
      }

      try {
        const newBoard = { name, visibility, theme, creator, members: members || [] };
        const result = await boardCollection.insertOne(newBoard);
        res.send({ ...newBoard, id: result.insertedId });
      } catch (error) {
        console.error("Error creating board:", error);
        res.status(500).send({ error: "Failed to create board" });
      }
    });

    app.put("/boards/:id", async (req, res) => {
      const { id } = req.params;
      const updatedBoard = req.body;

      if (!updatedBoard.name || !updatedBoard.visibility) {
        return res.status(400).send({ error: "Board name and visibility are required" });
      }

      try {
        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ error: "Invalid board ID" });
        }

        const result = await boardCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updatedBoard }
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

    // Removed DELETE /boards/:id endpoint




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

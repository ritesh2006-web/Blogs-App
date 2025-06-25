import express from "express";
import bodyParser from "body-parser";
import axios from "axios";
import dotenv from "dotenv";
import { marked } from "marked";
import multer from "multer";


dotenv.config();

const app = express();
const port = 3000;
const upload = multer({ dest: "public/uploads/" });

app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));
app.set("view engine", "ejs");

const posts = [];
let nextId = 1;

// Homepage - List all posts
app.get("/", (req, res) => {
  const q = req.query.q;
  let filteredPosts = posts;
  if (q) {
    const query = q.toLowerCase();
    filteredPosts = posts.filter(
      (p) => p.title.toLowerCase().includes(query) || p.content.toLowerCase().includes(query)
    );
  }
  res.render("index.ejs", { posts: filteredPosts, q });
});

app.get("/blog/:id", (req, res) => {
  const postId = Number(req.params.id);
  const post = posts.find((p) => p.id === postId);

  if (!post) {
    return res.status(404).send("Post not found!");
  }

  res.render("blog.ejs", { post });
})

// Show form to create a new post + chatbot
app.get("/new", (req, res) => {
  res.render("new.ejs", { response: null });
});

// Handle form submit to create new post
app.post("/new", upload.single("image"), (req, res) => {
  const { title, content } = req.body;
  let imageUrl = null;
  if (req.file) {
    imageUrl = "/uploads/" + req.file.filename;
  }
  if (!title || !content) {
    return res.status(400).send("Bad Request");
  }

  const newPost = {
    id: nextId++,
    title,
    content,
    imageUrl,
  };

  posts.push(newPost);
  res.redirect("/");
});

// Chatbot API - Ask question to AI
app.post("/ask", async (req, res) => {
  const prompt = req.body.prompt;
  try {
    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "mistralai/mistral-7b-instruct",
        messages: [{ role: "user", content: prompt }],
      },
      {
        headers: {
          "Authorization": `Bearer ${process.env.API_KEY}`,
          "HTTP-Referer": "http://localhost:3000",
          "Content-Type": "application/json",
        },
      }
    );

    const rawText = response.data.choices[0].message.content;

    // ✅ Convert Markdown to HTML
    const htmlResponse = marked(rawText);

    res.render("new.ejs", { response: htmlResponse });

  } catch (error) {
    console.error("API error:", error.response?.data || error.message);
    res.render("new.ejs", { response: "Error while getting AI response." });
  }
});

// Show edit form for specific post
app.get("/edit/:id", (req, res) => {
  const postId = Number(req.params.id);
  const post = posts.find((p) => p.id === postId);

  if (!post) {
    return res.status(404).send("Post not found!");
  }

  res.render("edit.ejs", { post });
});

// Handle edit form submission
app.post("/edit/:id", (req, res) => {
  const postId = Number(req.params.id);
  const post = posts.find((p) => p.id === postId);

  if (!post) {
    return res.status(404).send("Post not found!");
  }

  const { title, content } = req.body;

  if (!title || !content) {
    return res.status(400).send("Title and content are required.");
  }

  post.title = title;
  post.content = content;

  res.redirect("/");
});

// Delete post
app.post("/delete/:id", (req, res) => {
  const index = posts.findIndex(p => p.id === Number(req.params.id));
  if (index === -1) return res.status(404).send("Post not found!");

  posts.splice(index, 1);
  res.redirect("/");
});

// Start the server
app.listen(port, () => {
  console.log(`🟢 Server running at http://localhost:${port}`);
});

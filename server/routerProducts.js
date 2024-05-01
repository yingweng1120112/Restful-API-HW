import express, { json } from "express";
import multer from "multer";
import moment from "moment";
import cors from "cors";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import users from "./users.mjs";
import { v4 as uuidv4 } from "uuid";
import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";

const defaultData = { users: [], products: [] };
const db = new Low(new JSONFile("./db.json"), defaultData);
await db.read();

dotenv.config();
const secretKey = process.env.SECRET_KEY_LOGIN;
const upload = multer();

const whiteList = ["http://localhost:5500", "http://127.0.0.1:5500"];
const corsOptions = {
    credentials: true,
    origin(origin, callback) {
        if (!origin || whiteList.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error("不允許傳遞資料"))
        }
    }
};

const app = express();
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
    res.send("產品頁面")
})

// 獲取所有產品
app.get(" /api/products/", async (req, res) => {
    let users, error;
    users = await usersAll().then(result => result).catch(err => {
        error = err;
        return undefined;
    });
    if (error) {
        res.status(404).json({ status: "error", message: error.message });
        return false;
    }
    res.status(200).json({ status: "success", users });
});

// 新增一個產品
app.post("/api/products", upload.none(), async (req, res) => {
    let id, error;
    id = await userAdd(req).then(result => result).catch(err => {
        error = err;
        return undefined;
    });
    if (error) {
        res.status(400).json({ status: "error", message: error.message ? error.message : "資料輸入不正確" });
        return false;
    }
    res.status(201).json({ status: "success", id, message: "商品新增成功" });
});

app.post("/api/users/login", upload.none(), (req, res) => {
    const { account, password } = req.body;
    let user = users.find(u => u.account === account && u.password === password);
    if (user) {
        const token = jwt.sign({
            account: user.account,
            name: user.name,
            mail: user.mail,
            head: user.head
        }, secretKey, {
            expiresIn: "30m"
        });
        res.status(200).json({
            status: "success",
            token
        });
    } else {
        res.status(400).json({
            status: "error",
            message: "找不到使用者，帳號或密碼錯誤"
        });
    }
});

app.post("/api/users/logout", checkToken, (req, res) => {
    const token = jwt.sign({
        account: undefined,
        name: undefined,
        mail: undefined,
        head: undefined
    }, secretKey, {
        expiresIn: "-10s"
    });
    res.status(200).json({
        status: "success",
        token
    });
});

app.get("/api/users/status", checkToken, (req, res) => {
    const user = users.find(u => u.account === req.decoded.account);
    if (user) {
        const token = jwt.sign({
            account: user.account,
            name: user.name,
            mail: user.mail,
            head: user.head
        }, secretKey, {
            expiresIn: "30m"
        });
        res.status(200).json({
            status: "success",
            token
        });
    } else {
        res.status(400).json({
            status: "error",
            message: "找不到使用者，帳號錯誤"
        });
    }
});

// 使用 ID 作為搜尋條件來搜尋產品
app.get("/api/products/search?id=1", async (req, res) => {
    let user, error;
    user = await userSearch(req).then(result => result).catch(err => {
        error = err;
        return undefined;
    });
    if (error) {
        res.status(404).json({ status: "error", message: error.message ? error.message : "無效的搜尋條件" });
        return false;
    }
    const { password, ...others } = user;
    res.status(200).json({ status: "success", message: "搜尋成功", user: others });
});

// 獲取特定 ID 的產品
app.get("/api/products/1", async (req, res) => {
    let user, error;
    user = await userSingle(req).then(result => result).catch(err => {
        error = err;
        return undefined;
    });
    if (error) {
        res.status(404).json({ status: "error", message: error.message ? error.message : "Product not found" });
        return false;
    }
    const { password, ...others } = user;
    res.status(200).json({ status: "success", user: others });
});

// 更新特定 ID 的產品
app.put("/api/products/1", checkToken, upload.none(), async (req, res) => {
    let user, error;
    user = await userUpdate(req).then(result => result).catch(err => {
        error = err;
        return undefined;
    });
    if (error) {
        res.status(400).json({ status: "error", message: error.message ? error.message : "資料輸入不正確" });
        return false;
    }
    res.status(200).json({ status: "success", message: "使用者修改成功" });
});

// 刪除特定 ID 的產品
app.delete("/api/products/1", checkToken, async (req, res) => {
    let user, error;
    user = await userDelete(req).then(result => result).catch(err => {
        error = err;
        return undefined;
    });
    if (error) {
        res.status(404).json({ status: "error", message: error.message ? error.message : "商品不存在" });
        return false;
    }
    const token = jwt.sign({
        account: undefined,
        name: undefined,
        mail: undefined,
        head: undefined
    }, secretKey, {
        expiresIn: "-10s"
    });
    res.status(200).json({ status: "success", message: "商品刪除成功", token });
});

app.listen(3000, () => {
    console.log("running at http://localhost:3000");
})


function checkToken(req, res, next) {
    let token = req.get("Authorization");
    if (token && token.startsWith("Bearer ")) {
        token = token.slice(7);
        jwt.verify(token, secretKey, (err, decoded) => {
            if (err) {
                return res.status(401).json({
                    status: "error",
                    message: "登入驗證失效，請重新登入"
                });
            }
            req.decoded = decoded;
            next();
        });
    } else {
        return res.status(401).json({
            status: "error",
            message: "無登入驗證資料，請重新登入"
        });
    }
}
const express = require('express'), app = express(), JWT = require('jsonwebtoken'), JOI = require('joi'), PORT = process.env.PORT || 5000, fileUpload = require('express-fileupload'), secretKey = 'password', path = require('path'), fs = require('fs'), cors = require('cors')
let users = require('./database/users.json'), videos = require('./database/video.json')

const schema = JOI.object({
    username: JOI.string().min(3).max(30).alphanum().required(),
    password: JOI.string().pattern(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[a-zA-Z]).{4,}$/).required(),
})

app.use(cors())
app.use(express.json())
app.use(express.static(path.join(__dirname, 'uploads')))
app.use(fileUpload())

app.get('/info', (req, res) => {res.status(200).json({users, videos, message:"OK", status:200});})

// app.post('/search', (req, res) => {
//     const {value} = req.body
    
//     res.status(200).json({"videos": videos.filter(el => el.videoname.includes(value))})
// })

app.post('/register', (req, res) => {
    const img = req.files?.img, {username, password} = req.body, result = schema.validate({username, password})
    
    if (result.error || !img) return res.status(200).json({message: result?.error?.details[0]?.message || 'Please enter a picture', status:400})
    if (img.mimetype.split('/')[0] != 'image') return res.status(200).json({message: 'Please enter a picture', status:400})
    if (users.filter(user => user.username == username).length) return res.status(200).json({message: 'This  user is already registered', status:400})
    
    img.mv(path.join(__dirname, 'uploads', req.files.img.name))
    
    users.push({username, "userId": users.at(-1)?.userId + 1 || 1, password, "img":req.files.img.name})
    fs.writeFileSync(path.join(__dirname, 'database', 'users.json'),JSON.stringify(users, null, 2))
    
    res.status(200).json({"token": JWT.sign({"userId": users.at(-1).userId, "agent": req.headers['user-agent']}, secretKey), "status": 200})
})

app.post('/login', (req, res) => {
    const {username, password} = req.body, result = schema.validate({username, password}), user = users.filter(user => user.username === username)
    
    if (result.error || !user.length || user[0].password != password) return res.status(200).json({message: "Invalid input", status:400})
    
    res.status(200).json({"token": JWT.sign({"userId": user[0].userId, "agent": req.headers['user-agent']}, secretKey), "status":200})
    
})

app.post('/checkToken', (req, res) => {
    const {token} = req.body, data = checkToken(token, req)
    
    if (!data) return res.status(200).json({message: "Invalid token", status:400})

    const {userId} = data, user = users.filter(user => user.userId == userId)
    
    user[0] ? res.status(200).json({"img":user[0].img, "status":200}) : res.status(200).json({message: "Invalid token", status:400})
})

app.post('/upload', (req, res) => {
    try {
        const {videoname, token} = req.body, video = req.files?.video, data = JWT.verify(token, secretKey), user = users.filter(el => el.userId == data.userId)
        let check = checkToken(token, req)

        if (!videoname || !video || video.mimetype.split('/')[0] != 'video' || video.size > 52428800 || !user.length || !check) return res.status(200).json({message: "Invalid input", status:400})

        let date = new Date().toLocaleString().split(',')
        
        video.mv(path.join(__dirname, 'uploads', req.files.video.name))
        
        videos.push({ videoNameFile:req.files.video.name, videoname, "videoId": videos.at(-1)?.videoId + 1 || 1, "size": video.size / 1024 / 1024 | 0, "userId":user[0].userId, "username":user[0].username, "userImg":user[0].img, "date": `${date[0]}|${date[1].slice(0, 5)}`})        
        fs.writeFileSync(path.join(__dirname, 'database', 'video.json'), JSON.stringify(videos, null, 2));
        
        res.status(200).json({message: "Ok", status:200})
        
    } catch (error) {
        return res.status(200).json({message: "Invalid input", status:400})
    }
})

app.post('/ownVideo', (req, res) => {
    const {token} = req.body, data = checkToken(token, req)
    
    if (!data) return res.status(200).json({message: "Invalid token", status:400})
    
    const {userId} = data
    
    res.status(200).json({video: videos.filter(vid => vid.userId === userId), message:"okay", status:200})
})

app.post('/change', (req, res) => {
    const {token} = req.body, data = checkToken(token, req)
    
    if (!data) return res.status(200).json({message: "Invalid token", status:400})
    
    const {videoId, value} = req.body

    for (let el of videos) {if (el.videoId == videoId) {el.videoname = value; break}}
    
    fs.writeFileSync(path.join(__dirname, 'database', 'video.json'), JSON.stringify(videos, null, 2));
    
    res.status(200).json({message: "Ok", status:200})
})

app.delete('/delete', (req, res) => {
    const {token, videoId} = req.body, data = checkToken(token, req)
    
    if (!data || !videoId) return res.status(200).json({message: "Invalid token", status:400})

    videos = videos.filter(video => video.videoId != videoId)
    fs.writeFileSync(path.join(__dirname, 'database', 'video.json'), JSON.stringify(videos, null, 2));    

    res.status(200).json({message: "Ok", status:200})
})

function checkToken(token, req) {
    try {
        const data = JWT.verify(token, secretKey)
        
        if (data.agent != req.headers['user-agent']) throw new Error('Invalid token')
        
        return data
    } catch (error) {
        return null
    }
}

app.listen(PORT, console.log('http://localhost:5000'))







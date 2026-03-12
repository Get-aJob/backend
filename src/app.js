const express = require('express')
const cors = require('cors')

const app = express()

const indexRouter = require()

const errorRouter = require('./routes/errorRouter')

app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ tetended: true }))

app.use('/', indexRouter)

app.use(errorRouter)

module.exports = app
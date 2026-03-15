const express = require('express')
const router = express.Router()
const { getAllUsers } = require('../services/users')

router.get('/', async (req, res) => {
  try {
    const data = await getAllUsers()
    res.status(200).json({ users: data })
  } catch (err) {
    console.error('GET /users', err)
    res.status(500).json({ error: '회원 목록 조회에 실패했습니다.' })
  }
})

module.exports = router
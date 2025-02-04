// Import necessary modules and packages
const User = require('../models/user') // Importing User model
const express = require('express') // Importing Express framework
const router = express.Router() // Creating a router object to handle routes
const bcrypt = require('bcrypt') // Importing bcrypt for password hashing
const nodemailer = require('nodemailer') // Importing nodemailer for sending emails
const crypto = require('crypto') // Importing crypto for generating random codes
const jwt = require('jsonwebtoken') // Importing jsonwebtoken for user authentication
const sharp = require('sharp')
require('dotenv').config() // Loading environment variables
const { Department, Program } = require('../models/e-book')
const { checkRole, ROLES } = require('../middleware/auth-middleWare')
const { verifyToken, generateTokens } = require('../middleware/verifyToken')

// User registration endpoint
router.post('/student-registration', async (req, res) => {
  try {
    // Extract email and password from the request body
    const { email, password, chosenDepartment, chosenRole } = req.body

    if (!email || !password || !chosenRole || !chosenDepartment ) {
      return res.status(404).json({ msg: 'Please fill in all the required fields' })
    }

    if (chosenRole !== ROLES.STUDENT) {
      return res.status(400).json({ msg: 'Your role should be a student' });
    }

    // Find the email and assign it to existingUser variable
    const existingUser = await User.findOne({ email })

      // Check if user already exists
    if (existingUser) {
      return res.status(400).json({ msg: 'User already exists' })
    }

    // Find the department and assign it to department variable
    const department = await Department.findOne({ title: chosenDepartment })

    // Validate if department exists
    if(!department) {
      return res.status(404).json({ msg: 'Department doesnt exists' })
    }

    // Regular expression to match panpacific email format
    const emailRegex = /^[a-zA-Z0-9._-]+@panpacificu\.edu\.ph$/

    // Validate email format
    if (!emailRegex.test(email)) {
      return res.status(400).json({ msg: 'Invalid email format. Please use your panpacific email' })
    }

    // Regular expression to enforce password requirements
    const passwordRegex = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[\W_]).{8,}$/

    // Validate password format
    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        msg: 'Password should have capital letters, numbers and symbols',
      })
    }

    // Generate verification code
    const verificationCode = crypto.randomBytes(3).toString('hex')

    // Create nodemailer transporter
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.USER, // Email sender's username
        pass: process.env.PASSWORD // Email sender's password
      },
    })

    // Mail options for sending verification code
    const mailOptions = {
      from: process.env.USER, // Sender's email
      to: email, // Recipient's email
      subject: 'Email Verification',
      text: `Your verification code is: ${verificationCode}`,
    }

    // Send verification code via email
    await transporter.sendMail(mailOptions)

    // Extract username from email
    const usernameMatch = email.match(/^([a-zA-Z0-9._-]+)@panpacificu\.edu\.ph$/)
    const username = usernameMatch ? usernameMatch[1].split('.')[0] : ''

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Create a new user instance
    const newUser = User({
      email,
      username,
      password: hashedPassword,
      verificationCode,
      departmentID: department,
      departmentName: null,
      role: chosenRole
    })

    setTimeout(async () => {
      const expiredUser = await User.findOneAndDelete({ email, verified: false });
      if (expiredUser) {
        console.log(`Account for ${email} deleted due to expiration`);
      }
    }, 30 * 60 * 1000);

    // Save the new user to the database
    await newUser.save()

    // Respond with success message
    res.status(200).json({ msg: 'Verification code sent. Check your email to complete registration' })
  } catch (error) {
    // Handle errors
    res.status(500).json({ msg: error.message })
  }
})

// Common registration logic for users without departments
router.post('/staff-registration', async (req, res) => {
  try {
    // Extract email and password from the request body
    const { email, password, chosenRole } = req.body

    if (!email || !password || !chosenRole) {
      return res.status(400).json({ msg: 'Please fill in all the required fields' })
    }

    // Check if the email is in the array of staff or librarian emails
    const staffEmails = ['johnlino.demonteverde@panpacificu.edu.ph'] // Add staff emails to this array
    const librarianEmails = [''] // Add librarian emails to this array

    if ((chosenRole === ROLES.STAFF && !staffEmails.includes(email)) || (chosenRole === ROLES.LIBRARIAN && !librarianEmails.includes(email))) {
      return res.status(403).json({ msg: `You are not authorized to register as a ${chosenRole}` });
    }

    // Find the email and assign it to the existingUser variable
    const existingUser = await User.findOne({ email })

    // Check if user already exists
    if (existingUser) {
      return res.status(400).json({ msg: 'User already exists' })
    }

    // Regular expression to match panpacific email format
    const emailRegex = /^[a-zA-Z0-9._-]+@panpacificu\.edu\.ph$/

    // Validate email format
    if (!emailRegex.test(email)) {
      return res.status(400).json({ msg: 'Invalid email format. Please use your panpacific email' })
    }

    // Regular expression to enforce password requirements
    const passwordRegex = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[\W_]).{8,}$/;

    // Validate password format
    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        msg: 'Password should have capital letters, numbers, and symbols',
      })
    }

    // Generate verification code
    const verificationCode = crypto.randomBytes(3).toString('hex')

    // Create nodemailer transporter
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.USER, // Email sender's username
        pass: process.env.PASSWORD, // Email sender's password
      },
    })

    // Mail options for sending verification code
    const mailOptions = {
      from: process.env.USER, // Sender's email
      to: email, // Recipient's email
      subject: 'Email Verification',
      text: `Your verification code is: ${verificationCode}`,
    }

    // Send verification code via email
    await transporter.sendMail(mailOptions)

    // Extract username from email
    const usernameMatch = email.match(/^([a-zA-Z0-9._-]+)@panpacificu\.edu\.ph$/)
    const username = usernameMatch ? usernameMatch[1].split('.')[0] : ''

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Create a new user instance
    const newUser = new User({
      email,
      username,
      password: hashedPassword,
      verificationCode,
      role: chosenRole,
    })

    // Save the new user to the database
    await newUser.save()

    // Respond with success message
    res.status(200).json({ msg: 'Verification code sent. Check your email to complete registration' })
  } catch (error) {
    // Handle errors
    res.status(500).json({ msg: error.message })
  }
})


// Email Verification endpoint
router.post('/verify-email', async (req, res) => {
  try {
    const { email, verificationCode } = req.body

    // Find user by email
    const user = await User.findOne({ email })

    // If user not found
    if (!user) {
      return res.status(400).json({ msg: 'User not found' })
    }

    // If verification code is incorrect
    if (user.verificationCode !== verificationCode) {
      return res.status(400).json({ msg: 'Incorrect verification code' })
    }

    // Update user's verification status
    user.verified = true
    user.verificationCode = null
    await user.save()

    // Respond with success message
    res.status(200).json({ msg: 'Email verified successfully. User registered.' })
  } catch (error) {
    // Handle errors
    res.status(500).json({ msg: error.message })
  }
})

// User Log In endpoint
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body 

    // Find user by email
    const user = await User.findOne({ email })

    // If user not found
    if (!user) {
      res.status(404).json({ msg: 'User not found' })
    }

    // Compare passwords
    const isPasswordValid = await bcrypt.compare(password, user.password)
    if (!isPasswordValid) {
      return res.status(400).json({ msg: 'Incorrect password. Please try again.'})
    }

    // If user's email is not verified
    if(user.verificationCode !== null) {
      return res.status(400).json({ msg: 'Please verify your email first'})
    }

    const tokens = generateTokens(user)

    const token = tokens.accessToken;
    const refreshToken = tokens.refreshToken;

    res.status(200).json({
      token,
      refreshToken,
      userID: user._id,
      role: user.role,
      msg: 'User logged in successfully'
    })
  } catch (error) {
    // Handle errors
    res.status(500).json({ msg: error.message })
  }
})

router.get('/get-user/:userID', async (req, res) => {
  const { userID } = req.params
  try {
    if (!userID) {
      return res.status(404).json({ msg: 'userID is not found'})
    }

    const user = await User.findById(userID)

    if (!user) {
      return res.status(404).json({ msg: 'User with that ID is not found'})
    }

    let userDepartment;

    if (user.role !== ROLES.STAFF && user.role !== ROLES.LIBRARIAN) {
      // Find the department for non-staff and non-librarian users
      userDepartment = await Department.findOne({ _id: { $in: user.departmentID } })

      if (!userDepartment) {
        return res.status(404).json({ msg: 'User department is not found'})
      }
    }

    const currentUser = ({
      email: user.email,
      username: user.username,
      departmentName: userDepartment ? userDepartment : 'N/A',
      profilePic: user.profilePic,
      role: user.role
    })
    
    res.status(200).json({ currentUser })

  } catch (err) {
    res.status(500).json({ msg: err.message })
  }
})

router.post('/profile/upload-image/:userId', async (req, res) => {
  try {
    const { base64Image } = req.body
    const userId = req.params.userId

    const allowedFormats = ['jpeg', 'jpg', 'png']
    const detectedFormat = base64Image.match(/^data:image\/(\w+);base64,/)
    const imageFormat = detectedFormat ? detectedFormat[1] : null

    if (!imageFormat || !allowedFormats.includes(imageFormat.toLowerCase())) {
      return res.status(400).json({ msg: 'Unsupported image format. Please upload a JPEG, JPG, or PNG image.' })
    }

    const imageBuffer = Buffer.from(base64Image.split(',')[1], 'base64')

    const resizedImage = await sharp(imageBuffer)
      .resize({
        fit: 'cover',
        width: 200,
        height: 200,
        withoutEnlargement: true,
      })
      .toFormat(imageFormat)
      .toBuffer()

    const resizedImageBase64 = `data:image/${imageFormat};base64,${resizedImage.toString('base64')}`

    await User.findByIdAndUpdate(userId, { profilePic: resizedImageBase64 })

    res.status(200).json({ msg: 'Profile picture uploaded successfully', resizedImage: resizedImageBase64 })
  } catch (error) {
    console.error(error)
    res.status(500).json({ msg: 'Internal Server Error' })
  }
})

// Delete user endpoint (accessible only by staff)
router.delete('/delete-user/:userId', checkRole([ROLES.STAFF]), async (req, res) => {
  try {
    const { userId } = req.params;

    // Ensure that the userId is provided
    if (!userId) {
      return res.status(400).json({ msg: 'User ID is required for deletion.' });
    }

    // Check if the user to be deleted exists
    const userToDelete = await User.findById(userId);
    if (!userToDelete) {
      return res.status(404).json({ msg: 'User not found' });
    }


    // Perform the deletion
    await User.findByIdAndDelete(userId);

    res.status(200).json({ msg: 'User deleted successfully.' });
  } catch (error) {
    // Handle errors
    res.status(500).json({ msg: error.message });
  }
})

// Get programs + recommended programs
router.get('/:userID/programs', verifyToken, checkRole([ROLES.STUDENT]), async (req, res) => {
  const { userID } = req.params;

  try {
    if (!userID) {
      return res.status(404).json({ msg: 'User ID is not found' });
    }

    const user = await User.findById(userID);

    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    const userDepartment = await Department.findById(user.departmentID)

    if (!userDepartment) {
      return res.status(404).json({ msg: 'User department is not found' })
    }

    const recommendedPrograms = await Program.find({ _id: { $in: userDepartment.programs } });
    const restOfPrograms = await Program.find({ _id: { $nin: recommendedPrograms.map(p => p._id) } })

    res.status(200).json({
      msg: 'Recommended Programs and Rest of the Programs:',
      recommendedPrograms,
      restOfPrograms,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/admin-dashboard', async (req, res) => {
  try {
    const departmentStats = await User.aggregate([
      {
        $group: {
          _id: '$departmentID',
          count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: null,
          totalUsers: { $sum: '$count' },
          departments: {
            $push: {
              departmentID: '$_id',
              count: '$count',
            },
          },
        },
      },
      {
        $unwind: { path: '$departments', preserveNullAndEmptyArrays: true },
      },
      {
        $lookup: {
          from: 'departments',
          localField: 'departments.departmentID',
          foreignField: '_id',
          as: 'department',
        },
      },
      {
        $unwind: { path: '$department', preserveNullAndEmptyArrays: true },
      },
      {
        $project: {
          department: {
            $ifNull: ['$department.title', 'Others'],
          },
          percentage: {
            $multiply: [
              { $cond: [{ $eq: ['$totalUsers', 0] }, 0, { $divide: ['$departments.count', '$totalUsers'] }] },
              100,
            ],
          },
        },
      },
      {
        $group: {
          _id: '$department',
          percentage: { $max: '$percentage' },
        },
      },
      {
        $project: {
          department: '$_id',
          percentage: 1,
          _id: 0,
        },
      },
    ]);

    const allDepartments = await Department.find({})

    const result = allDepartments.map(department => {
      const matchingStat = departmentStats.find(stat => stat.department === department.title)
      return {
        department: department.title,
        percentage: matchingStat ? matchingStat.percentage : 0,
      }
    })

    res.status(200).json({
      departmentStats: result,
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

module.exports = router

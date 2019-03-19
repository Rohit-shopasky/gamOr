"use strict";
let multer             = require('multer');
let path               = require('path');

const user             = require('./userProfileController');
const listAndQuestions = require('./listAndQuestions');
const moneyAndPoints   = require('./moneyAndPoints');
const notifications    = require('./notifications');
const history          = require('./history');
const like             = require('./like');

let imageFilter = (req, file, cb) => {
    // accept image only
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
        return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
};

let storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let imageDirPath= path.join(__dirname, '/../../img');
    cb(null, path.join(imageDirPath));
  },
  filename: (req, file, cb) => {
    cb(null, Date.now()+"-"+file.originalname);
  }
});

let upload  = multer({ storage: storage, size: 1024 * 1024 * 1024 * 10, fileFilter: imageFilter });

module.exports = function(app) {

    /*
     * APIs related to Profile Starts
    */
    // process the login form
    app.post('/user/manual/login', user.login);

    app.post('/user/logout', user.logout);

    // process the signup form
    app.post('/user/socialmedia/login', user.signupSocialMedia);

    app.post('/user/manual/signup', upload.single('profile_image_url'), user.signupManual);

    app.post('/user/profile/image/update', upload.single('profile_image_url'), user.updateProfilePic);

    //POST-Update password
    app.post('/user/profile/password/reset', user.resetPassword);

    //User Information by his ID
    app.get('/user/info', user.userInfo);

    //Update notification ID
    app.post('/update/fcm', user.updateFCM);

    //Users from gamor emails and there results
    app.post('/forgot/password', user.forgotPassword);

    /*
     * APIs related to Profile Ends
     *
     * APIs related to list and questions starts
    */

    // get categories
    app.get('/category/list', listAndQuestions.categoryList);

    //Mark / Remove Favourite
    app.post('/category/favourites/set', listAndQuestions.favouriteStatus);

    //Get Favourites
    app.get('/category/favourites', listAndQuestions.favourites);

    //Get Trending
    app.get('/category/trendings', listAndQuestions.trendings);

    //get questions and options
    app.get('/category/questions', listAndQuestions.questions);

    //save option
    app.post('/category/question/saveanswer', listAndQuestions.chosenOne);

    //Delete option
    app.post('/category/question/deleteanswer', listAndQuestions.deleteAnswer);

    /*
     * APIs related to list and questions ends
     *
     * APIs related to notifications starts
    */

    //notification by user id
    app.get('/notifications', notifications.getNotifications);

    // invite
    app.post('/notifications/invite', notifications.invite);

    // Email of Contact Us
    app.post('/contactus', notifications.contactUs);

    // Email of Question Suggestion
    app.post('/question/suggestion', notifications.questionSuggestion);

    /*
     * APIs related to notifications ends
     *
     * APIs related to History starts
    */

    //get all user history
    app.get('/history', history.history);

    //get all user Info of specific history
    app.get('/history/info', history.historyInfo);

    /*
     * APIs related to History ends
     *
     * APIs related to money and points starts
    */

    // User Ranking by user id
    app.get('/ranking', moneyAndPoints.ranking);

    // User Ranking by user id
    app.get('/logs/show', moneyAndPoints.logs);

    /*
     * APIs related to money and points ends
     *
     * APIs related to like starts
    */

    // friend and confirm
    app.post('/like', like.like);

    // unfriend
    app.post('/unfriend', like.unfriend);

    //Ranking Among Friends
    app.get('/ranking/friends', like.rankingAmongFriends);

    //Friends likes
    app.get('/user/likes', like.userLikes);

    //Friend's Profile
    app.get('/profile/friend', like.friendProfile);

    //Users from gamor emails and there results
    app.post('/users/gamor', like.gamorUsers);

    /*
     * APIs related to like ends
    */
};

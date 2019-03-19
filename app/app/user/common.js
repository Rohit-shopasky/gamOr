"use strict";
// load up the user model
const moment = require('moment');
const async  = require('async');
const bcrypt = require('bcrypt-nodejs');

const headers = {
  'Content-Type': 'application/json'
};

let headerUser = {
    'Content-Type' : 'application/json'
};

//Required Files
const CRUD  = require('./CRUD');

module.exports = {

    adminPanelImagePath: () => "https://panel.dipping67.hasura-app.io/admin/assets/img/",

    imagePath: () => "https://api.dipping67.hasura-app.io/image/",

    todayByMoment: () => moment().utc().format("YYYY-MM-DD[T]HH:mm:ss.SSSSSSZ"),

    getCategoriesWithPrediction: (res, headerUser, categoriesList, user_id, check_is_active, cb) => {
        let where;
        let getCategory = (category, callback)=> {
            category['icon'] = "https://panel.dipping67.hasura-app.io/admin/assets/img/"+category['icon'];

            where= {
                user_id,
                'category_id': category.categories_id
            };
            CRUD.select(res, 'favourite', where, '', '', headerUser, (status, favouriteList) => {
                category['is_favourite']= (favouriteList.length) ? true: false;

                where = {
                    parent_id   : category.categories_id,
                    is_approved : true,
                    is_live     : true
                }
                if(check_is_active) where["is_active"]= true;
                CRUD.select(res, 'categories', where, '', '', headerUser, (status, categoriesList) => {
                    if(categoriesList.length > 0) category['list'] = true;
                    else category['list'] = false;

                    callback(null, category);
                });
            });
        };

        async.map(categoriesList, getCategory, (err, categoriesListWithPredictions) => {
            cb(err, categoriesListWithPredictions);
        });
    },

    // generating a hash
    generateHash: function(password) {
        return bcrypt.hashSync(password, bcrypt.genSaltSync(8), null);
    },

    // checking if password is valid
    validPassword: function(dbhashpassword, password) {
        return bcrypt.compareSync(password, dbhashpassword);
    },

    getBadgeInformation: function(res, userIds, headerUser, cb) {

        let where= {user_id: { "$in": userIds }};
        CRUD.select(res, 'user_balance', where, '', '', headerUser, (status, userBalances) => {
            if(!status.status) {
                cb(status);
            }

            where= {};

            let orderBy= [ { column: 'points', type: 'asc' } ];

            CRUD.select(res, 'badges', where, '', orderBy, headerUser, (status, badges) => {
                if(!status.status) {
                    console.error("status=>"+JSON.stringify(status));
                    cb({});
                }

                if(badges.length) cb( status, getBadgesForAllUsersWithUserIds(badges, userBalances) );
                else cb(status, {badges: "Sage"});
            });
        });
    }
};

function getBadgesForAllUsersWithUserIds(badges, userBalances) {
    let finalBadges= [];
    userBalances.forEach( balance => {
        if( balance.points < 25 ) return true;

        let badgeIndex = badges.findIndex( badge => badge.points > balance.points);
        if(!~badgeIndex) badgeIndex= badges.length;

        if(~badgeIndex) {
            let badge= Object.assign({}, badges[ badgeIndex - 1 ]);
            if(badge.image) badge.image= "https://panel.dipping67.hasura-app.io/admin/assets/img/" + badge.image;
            badge.user_id= balance.user_id;
            finalBadges.push(Object.assign({}, badge));
        }
    });
    return finalBadges;
}
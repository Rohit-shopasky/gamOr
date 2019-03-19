"use strict";
// load up the user model
var fetch   = require('node-fetch');
var moment   = require('moment');
var async = require('async');

const headers = {
  'Content-Type': 'application/json'
};

let headerUser = {
    'Content-Type' : 'application/json'
};

//Required Files
const CRUD  = require('./CRUD');
const common= require('./common');

module.exports = {
    history: (req, res) => {
        let user_id = +req.query.user_id;
        headerUser['X-Hasura-User-Id'] = req.get("X-Hasura-User-Id");
        headerUser['Authorization']    = req.get("Authorization") || "Bearer "+req.get("x-hasura-session-id");
        headerUser['X-Hasura-Role']    = req.get("X-Hasura-Role");

        let where, categoryIds= [], questionIds= [], finalList, category, history, orderBy, chunk;
        orderBy= [ { column: 'timestamp', type: 'desc' } ];
        CRUD.select(res, 'history', { user_id }, '', orderBy, headerUser, (status, historyList) => {

            historyList.forEach(h => {
                categoryIds.push(h.category_id);
                questionIds.push(h.question_id);
            });

            where= {
                categories_id : {"$in": categoryIds},
            };
            CRUD.select(res, 'categories', where, '', '', headerUser, (status, categoryList) => {

                categoryIds= categoryList.map( c => c.categories_id );
                where= {
                    category_id: {"$in": categoryIds},
                    question_id: {"$in": questionIds}
                };
                CRUD.select(res, 'question', where, '', '', headerUser, (status, questionList) => {

                    finalList= questionList.map(q => {
                        category= Object.assign({}, categoryList.find( c => c.categories_id === q.category_id ) );

                        if(category && category.icon) category.icon = common.adminPanelImagePath()+category.icon;

                        history = historyList.find( h => h.question_id === q.question_id );
                        return Object.assign({}, q, category, { id: history.id, create_at: history.timestamp });
                    });
                    finalList.sort((a, b)=> Date(a.create_at) - new Date(b.create_at));
                    res.json({status, data: finalList });
                });
            });
        });
    },

    historyInfo: (req, res) => {
        let history_id = +req.query.history_id;
        headerUser['X-Hasura-User-Id'] = req.get("X-Hasura-User-Id");
        headerUser['Authorization']    = req.get("Authorization") || "Bearer "+req.get("x-hasura-session-id");
        headerUser['X-Hasura-Role']    = req.get("X-Hasura-Role");

        let where, answer, finalList={};
        CRUD.select(res, 'history', { id: history_id }, '', '', headerUser, (status, historyList) => {

            where= {categories_id: historyList[0].category_id };
            CRUD.select(res, 'categories', where, '', '', headerUser, (status, categoryList) => {

            where= {question_id: historyList[0].question_id };
                CRUD.select(res, 'question', where, '', '', headerUser, (status, questionList) => {

                    CRUD.select(res, 'options', where, '', '', headerUser, (status, optionList) => {

                        where['user_id']= historyList[0].user_id;
                        CRUD.select(res, 'user_answers', where, '', '', headerUser, (status, userAnswer) => {

                            answer= (userAnswer.length) ? userAnswer[0] : { 'user_answer_id': 0 };

                            Object.assign(finalList, answer, categoryList[0], questionList[0], {"id": history_id});
                            finalList.options = optionList;
                            res.json({status, data: finalList });
                        });
                    });
                });
            });
        });
    },

};
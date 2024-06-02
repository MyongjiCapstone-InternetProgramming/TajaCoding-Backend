require('dotenv').config(); //process.env로 환경변수 접근가능
const express = require('express'); //express를 설치했기 때문에 가져올 수 있다.
const app = express();
const cors = require('cors');
app.use(cors()); // CORS 허용
app.use(express.json());
app.use('/static', express.static('public'));

const mysql = require('mysql');
const pool = mysql.createPool({
    connectionLimit: 10,
    host:'localhost',
    user:'taco',
    password:'taco123',
    database:'tajacoding'
});

// 임채윤 - 회원가입 기능 구현 (240527)
app.post('/signup', (req, res) => {
    if (!req.body) {
        res.send({status:400, data:{message:"Body is Missing"}});
    }
    else {
        pool.getConnection((err, connection) => {
            if (err) {
                return res.send({status:500, data:{message:'Error Connecting'}});
            }
            let userCheck = false;
            connection.query(`SELECT * FROM Users WHERE id='${req.body.id}' or nickname='${req.body.nickname}';`, (error, results, fields)=>{
                if (error){
                    connection.release();
                    return res.send({status:500, data:{message:'Signup DB Querying Failed'+error}});
                }
                if (results.length>0){
                    userCheck = true;
                }
                if (!userCheck){ // 유저가 존재하면 else문으로 이동
                    connection.query(`INSERT INTO Users VALUES ('${req.body.id}', '${req.body.password}', '${req.body.nickname}')`, (error, results, fields) => {
                        connection.release();
                        if (error) {
                            return res.send({status:500, data:{message:error}});
                        }
                        return res.send({status:200, data:{message:'성공적으로 회원가입 되었습니다.'}});
                    });
                } else { 
                    connection.release();
                    return res.send({status:400, data:{message:'이미 존재하는 아이디 또는 닉네임입니다.'}});
                }
            })
        });
    }
})

// 임채윤 - 로그인 기능 구현 (240527)
app.post('/login', (req,res) => {
    if (!req.body) {
        res.send({status:400, data:{message:"Body is Missing"}});
    }
    else {
        pool.getConnection((err, connection) => {
            if (err) {
                return res.send({status:500, data:{message:'Error Connecting'}});
            }
            connection.query(`SELECT * FROM Users WHERE id='${req.body.id}' and pinNumber='${req.body.password}'`, (error, results, fields) => {
                connection.release();
                if (error) {
                    return res.send({status:500, data:{message:'Error Querying Databse'}});
                }
                if (results.length === 0){
                    return res.send({status:400, data:{message:'아이디 또는 핀번호를 잘못입력했습니다.'}})
                }
                return res.send({status:200, data:{message:`성공적으로 로그인하였습니다. ${results[0].nickname}님 환영합니다.`, nickname: results[0].nickname, id: results[0].id}});
            });
        });
    }
})

// 임채윤 - 개념퀴즈 가져오기 (240529)
// req.param을 통해 파라미터로 입력받은 언어를 가져옴 (ex: JAVA, PYTHON) 그리고 해당 언어인 개념퀴즈들을 가져옴 
app.get('/api/wordquiz', (req, res) => {
    const language = req.param('language');
    pool.getConnection((err, connection) => {
        if (err) {
            return res.send({status:500, data:{message:'Error Connecting'}});
        }
        connection.query(`SELECT * FROM wordquiz WHERE language='${language}'`, (error, results, fields) => {
            connection.release();
            if (error) {
                return res.send({status:500, data:{message:'Error Querying Databse'}});
            }
            return res.send({status:200, data:results});
        });
    });
})

// 임채윤 - 오답노트 반영하기 (240529)
app.post('/api/wrongnote', (req, res)=>{
    if (!req.body) {
        return res.send({status:400, data:{message:"Body is Missing"}});
    }
    if (!req.body.userId || !req.body.quizId || !Array.isArray(req.body.quizId)){
        return res.send({status:400, data:{message:"Invalid Data"}});
    }
    pool.getConnection((err, connection) => {
        if (err) {
            return res.send({status:500, data:{message:'Error Connecting'}});
        }
        const promises = req.body.quizId.map(quizId => {
            return new Promise((resolve, reject) => {
                connection.query(`INSERT INTO wrongnote (userId, quizId) VALUES (?, ?)`, 
                [req.body.userId, quizId], (error, results, fields) => {
                    if (error) return reject(error);
                    resolve();
                });
            });
        });
        Promise.all(promises)
        .then(() => {
            res.send({status: 200, data: {message: '오답노트에 추가되었습니다.'}});
        })
        .catch(error => {
            console.log(error);
            res.send({status: 500, data: {message: 'Error Insert WrongNote'}});
        })
        .finally(() => {
            connection.release();
        });
    });
})

// 임채윤 - 오답노트 목록 불러오기 (240530)
app.get('/api/wrongnote', (req, res)=>{
    const userId = req.param('userId');
    if (!userId) {
        return res.send({status:400, data:{message:"Param is Missing"}});
    }
    pool.getConnection((err, connection) => {
        if (err) {
            return res.send({status:500, data:{message:'Error Connecting'}});
        }
        connection.query(`SELECT wrongnote.wrongId, wordquiz.language, wordquiz.question, wordquiz.answer, wrongnote.createDate FROM wordquiz join wrongnote on wordquiz.quizId=wrongnote.quizId WHERE wrongnote.userId='${userId}';`, (error, results, fields) => {
            connection.release();
            if (error) {
                console.log(error);
                return res.send({status:500, data:{message:'Error Getting WrongNote'}});
            }
            return res.send({status:200, data:results});
        });
    });
})

// 임채윤 - 오답노트 개념퀴즈 재시도 (240531)
app.get('/api/wrongnotestart/:userId', (req, res) => {
    const userId = req.param('userId');
    const language = req.param('language');
    pool.getConnection((err, connection) => {
        if (err) {
            return res.send({status:500, data:{message:'Error Connecting'}});
        }
        connection.query(`SELECT wordquiz.* FROM wordquiz join wrongnote on wordquiz.quizId=wrongnote.quizId WHERE wrongnote.userId='${userId}' and wordquiz.language='${language}'`, (error, results, fields) => {
            connection.release();
            if (error) {
                return res.send({status:500, data:{message:'Error Querying Database'}});
            }
            return res.send({status:200, data:results});
        });
    });
})

// 임채윤 - 오답노트 삭제하기 (240530)
app.delete('/api/wrongnote', (req, res)=>{
    const quizId = req.param('quizId');
    if (!quizId) {
        return res.send({status:400, data:{message:"Param is Missing"}});
    }
    pool.getConnection((err, connection) => {
        if (err) {
            return res.send({status:500, data:{message:'Error Connecting'}});
        }
        connection.query(`DELETE FROM wrongnote WHERE quizId='${quizId}'`, (error, results, fields) => {
            connection.release();
            if (error) {
                return res.send({status:500, data:{message:'Error Delete WrongNote'}});
            }
            return res.send({status:200, data:{message:"성공적으로 오답노트를 삭제했습니다."}});
        });
    });
})

// 임채윤 - 커스텀 글쓰기 (240530)
app.post('/api/custom', (req, res)=>{
    if (!req.body) {
        return res.send({status:400, data:{message:"Body is Missing"}});
    }
    if (!req.body.title || !req.body.descript || !req.body.language || !req.body.writer || !req.body.content || !Array.isArray(req.body.content)){
        return res.send({status:400, data:{message:"Invalid Data"}});
    }
    pool.getConnection((err, connection) => {
        if (err) {
            return res.send({status:500, data:{message:'Error Connecting'}});
        }
        connection.query(`INSERT INTO customcode (language, title, descript, writer) VALUES (?, ?, ?, ?)`, [req.body.language, req.body.title, req.body.descript, req.body.writer], (error, results, fields) => {
            if (error) {
                connection.release();
                return res.send({status:500, data:{message:'Error Querying Databse'}});
            }
            connection.query(`INSERT INTO customcodecontent (codeId, content) VALUES (?, ?)`, [results.insertId, JSON.stringify(req.body.content)], (error, results, fields) =>{
                if (error){
                    connection.release();
                    return res.send({status:500, data:{message:error}})
                }
                connection.release();
                return res.send({status:200, data:{message:`커스텀 글을 작성했습니다.`}});
            })
        });
    });
})

// 임채윤 - 커스텀 조회하기 (240530)
app.get('/api/custom/:language', (req, res)=>{
    const language = req.param('language');
    pool.getConnection((err, connection) => {
        if (err) {
            return res.send({status:500, data:{message:'Error Connecting'}});
        }
        connection.query(`SELECT * FROM customcode WHERE language='${language}'`, (error, results, fields) => {
            connection.release();
            if (error) {
                return res.send({status:500, data:{message:'Error Querying Databse'}});
            }
            return res.send({status:200, data:results});
        });
    });
})

// 임채윤 - '나의' 커스텀 조회하기 (240530)
app.get('/api/mycustom', (req, res)=>{
    const userId = req.param('userId');
    const language = req.param('language');
    if (!userId || !language) {
        return res.send({status:400, data:{message:"Param is Missing"}});
    }
    pool.getConnection((err, connection) => {
        if (err) {
            return res.send({status:500, data:{message:'Error Connecting'}});
        }
        connection.query(`SELECT * FROM customcode WHERE language='${language}' and writer='${userId}'`, (error, results, fields) => {
            connection.release();
            if (error) {
                return res.send({status:500, data:{message:'Error Querying Databse'}});
            }
            return res.send({status:200, data:results});
        });
    });
})

// 임채윤 - 내 커스텀 삭제하기 (240531)
app.delete('/api/mycustom/:codeId', (req, res)=>{
    const codeId = req.param('codeId');
    if (!codeId) {
        return res.send({status:400, data:{message:"Param is Missing"}});
    }
    pool.getConnection((err, connection) => {
        if (err) {
            return res.send({status:500, data:{message:'Error Connecting'}});
        }
        connection.query(`DELETE FROM customcode WHERE codeId='${codeId}'`, (error, results, fields) => {
            connection.release();
            if (error) {
                return res.send({status:500, data:{message:'코드 삭제에 실패하였습니다.'}});
            }
            return res.send({status:200, data:{message:'성공적으로 삭제되었습니다.'}});
        });
    });
})

// 임채윤 - 커스텀 시작하기 (내용 불러오기) (240531)
app.get('/api/customstart/:codeId', (req, res) => {
    const codeId = req.param('codeId');
    if (!codeId) {
        return res.send({status:400, data:{message:"Param is Missing"}});
    }
    pool.getConnection((err, connection) => {
        if (err) {
            return res.send({status:500, data:{message:'Error Connecting'}});
        }
        connection.query(`SELECT content FROM customcodecontent WHERE codeId='${codeId}'`, (error, results, fields) => {
            connection.release();
            if (error) {
                return res.send({status:500, data:{message:'불러오는것에 실패하였습니다.'}});
            }
            const result = JSON.parse(results[0].content);
            return res.send({status:200, data:result});
        });
    });
})

// 임채윤 - 커스텀 끝 (평균시간 갱신하기) (240531)
app.put('/api/custom', (req, res) => {
    if (!req.body) {
        return res.send({status:400, data:{message:"Body is Missing"}});
    }
    if (!req.body.codeId || !req.body.time){
        return res.send({status:400, data:{message:"Invalid Data"}});
    }
    pool.getConnection((err, connection) => {
        if (err) {
            return res.send({status:500, data:{message:'Error Connecting'}});
        }
        connection.query(`UPDATE customcode SET tryCount=tryCount+1,
        averageTime=((averageTime*(tryCount-1))+${Number.parseInt(req.body.time)})/tryCount WHERE codeId=${req.body.codeId}`, (error, results, fields) => {
            connection.release();
            if (error) {
                return res.send({status:500, data:{message:'갱신에 실패하였습니다.'}});
            }
            return res.send({status:200, data:{message:"평균시간이 갱신되었습니다."}});
        });
    });
})
// 임채윤 - 긴글타자 끝 (평균시간 갱신하기) (240531)
app.put('/api/longcode', (req, res) => {
    if (!req.body) {
        return res.send({status:400, data:{message:"Body is Missing"}});
    }
    if (!req.body.codeId || !req.body.time){
        return res.send({status:400, data:{message:"Invalid Data"}});
    }
    pool.getConnection((err, connection) => {
        if (err) {
            return res.send({status:500, data:{message:'Error Connecting'}});
        }
        connection.query(`UPDATE longcode SET tryCount=tryCount+1,
        averageTime=((averageTime*(tryCount-1))+${Number.parseInt(req.body.time)})/tryCount WHERE id=${req.body.codeId}`, (error, results, fields) => {
            connection.release();
            if (error) {
                return res.send({status:500, data:{message:`갱신에 실패하였습니다. ${error}`}});
            }
            return res.send({status:200, data:{message:"평균시간이 갱신되었습니다."}});
        });
    });
})
// 임채윤 - 빈칸퀴즈 끝 (평균점수 갱신하기) (240531)
app.put('/api/blankcode', (req, res) => {
    if (!req.body) {
        return res.send({status:400, data:{message:"Body is Missing"}});
    }
    if (!req.body.codeId || !req.body.score){
        return res.send({status:400, data:{message:"Invalid Data"}});
    }
    pool.getConnection((err, connection) => {
        if (err) {
            return res.send({status:500, data:{message:'Error Connecting'}});
        }
        connection.query(`UPDATE blankquiz SET tryCount=tryCount+1,
        averageScore=((averageScore*(tryCount-1))+${Number.parseInt(req.body.score)})/tryCount WHERE id=${req.body.codeId}`, (error, results, fields) => {
            connection.release();
            if (error) {
                return res.send({status:500, data:{message:'갱신에 실패하였습니다.'}});
            }
            return res.send({status:200, data:{message:"평균점수가 갱신되었습니다."}});
        });
    });
})

// 최민석
app.get('/longcode', (req, res) => {
    const start = Date.now();
    pool.getConnection((err, connection) => {
        if (err) {
            return res.send({status: 500, data: {message: 'Error Connecting to Database'}});
        }
        connection.query(`SELECT id, language, title, descript, difficulty, averageTime FROM longcode;`, (error, results, fields) => {
            connection.release();
            if (error) {
                console.error('Database connection error:', error);
                return res.send({status: 500, data: {message: 'Error Connecting to Database', error: error}});
            }
            console.log(`Query executed in ${Date.now() - start}ms`);
            return res.send({status: 200, data: results});
        });
    });
});

// 최민석
app.get('/longcode/:id', (req, res) => {
    const { id } = req.params;
    const start = Date.now();
    pool.getConnection((err, connection) => {
        if (err) {
            return res.send({status: 500, data: {message: 'Error Connecting to Database'}});
        }
        connection.query(`SELECT content FROM longcodecontent WHERE longId = ?`, [id], (error, results, fields) => {
            connection.release();
            console.log(`Query executed in ${Date.now() - start}ms`);
            if (error) {
                console.error('Database connection error:', error);
                return res.send({status: 500, data: {message: 'Error Querying Database', error: error}});
            }
            if (results.length === 0) {
                return res.send({status: 404, data: {message: 'Content Not Found'}});
            }
            const result = JSON.parse(results[0].content)
            return res.send({status: 200, data: result});
        });
    });
});

// 최민석
app.get('/blankcode', (req, res) => {
    const start = Date.now();
    pool.getConnection((err, connection) => {
        if (err) {
            return res.send({status: 500, data: {message: 'Error Connecting to Database'}});
        }
        connection.query(`SELECT id, language, title, descript, difficulty, averageScore FROM blankquiz`, (error, results, fields) => {
            connection.release();
            console.log(`Query executed in ${Date.now() - start}ms`);
            if (error) {
                console.error('Database connection error:', error);
                return res.send({status: 500, data: {message: 'Error Connecting to Database', error: error}});
            }
            return res.send({status: 200, data: results});
        });
    });
});

// 최민석
app.get('/blankcode/:id', (req, res) => {
    const { id } = req.params;
    const start = Date.now();
    pool.getConnection((err, connection) => {
        if (err) {
            return res.send({status: 500, data: {message: 'Error Connecting to Database'}});
        }
        connection.query(`SELECT content, blankId, result, example FROM blankquizcontent WHERE blankId = ?`, [id], (error, results, fields) => {
            connection.release();
            console.log(`Query executed in ${Date.now() - start}ms`);
            if (error) {
                console.error('Database connection error:', error);
                return res.send({status: 500, data: {message: 'Error Querying Database', error: error}});
            }
            if (results.length === 0) {
                return res.send({status: 404, data: {message: 'Content Not Found'}});
            }
            const content = JSON.parse(results[0].content)
            const example = JSON.parse(results[0].example)
            const result = JSON.parse(results[0].result)
            return res.send({status: 200, data: {content:content, example:example, result:result}});
        });
    });
});

app.listen(8080, '0.0.0.0', ()=>{
    console.log('http://localhost:8080')
})
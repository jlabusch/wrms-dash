module.exports = function(req, res, next){
    console.log('availability()');
    res.json({
        result: 0
    });
    next && next(false);
};

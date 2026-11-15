'use strict';
const routes={title:require('../lib/endpoint-title-search.cjs'),lookup:require('../lib/endpoint-book-lookup.cjs'),health:require('../lib/endpoint-operations-health.cjs')};
module.exports=async function(req,res){const key=String(req.query?.route||'');if(!Object.prototype.hasOwnProperty.call(routes,key))return res.status(404).json({error:'Not found'});return routes[key](req,res)};

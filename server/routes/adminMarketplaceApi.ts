import { Router, Request, Response } from 'express';
import { MarketplaceStore } from '../db/marketplaceStore.js';
import { MarketplaceControlStore, MarketplaceInputError } from '../db/marketplaceControlStore.js';
import { validateProductInput } from '../services/marketplaceProductPolicy.js';
import { productReadiness } from '../../shared/marketplacePolicy.js';
import { toAdminMarketplaceProduct } from '../types/marketplace.js';
// Mounted after requireAdmin on adminRouter; none of these routes are public.
export const adminMarketplaceRouter = Router();
const handle = (action: (req:Request,res:Response)=>Promise<void>) => async (req:Request,res:Response) => {
  try { await action(req,res); } catch (e) { res.status(e instanceof MarketplaceInputError ? e.status : 500).json({error:e instanceof MarketplaceInputError ? e.message : 'Marketplace operation failed.'}); }
};
async function adminProducts() {
  const categories = await MarketplaceControlStore.getCategories();
  return (await MarketplaceStore.getAdminProducts()).map(p=>({...p,readiness:productReadiness(p,categories)}));
}
async function adminProduct(record: Parameters<typeof toAdminMarketplaceProduct>[0]) {
  const product = (await MarketplaceStore.withCategoryLabels([toAdminMarketplaceProduct(record)]))[0];
  return {...product,readiness:productReadiness(product,await MarketplaceControlStore.getCategories())};
}
async function metrics() {
  const products = await adminProducts(); const active = products.filter(p=>!p.archived);
  return {...await MarketplaceStore.getAdminMetrics(),needsReview:active.filter(p=>!p.readiness.ready).length,
    physical:active.filter(p=>p.productKind === 'physical').length,digital:active.filter(p=>p.productKind === 'digital').length,service:active.filter(p=>p.productKind === 'service').length,
    newInquiries:(await MarketplaceControlStore.listInquiries({status:'new',pageSize:1})).total};
}
adminMarketplaceRouter.get('/metrics',handle(async (_req,res)=>{res.json({success:true,metrics:await metrics()});}));
adminMarketplaceRouter.get('/products',handle(async(req,res)=>{
  let products = await adminProducts(); const {category,status,search,productKind}=req.query;
  if (category && category !== 'all') products=products.filter(p=>p.category===category);
  if (productKind && productKind !== 'all') products=products.filter(p=>p.productKind===productKind);
  if (status === 'published') products=products.filter(p=>p.published&&!p.archived);
  if (status === 'draft') products=products.filter(p=>!p.published&&!p.archived);
  if (status === 'archived') products=products.filter(p=>p.archived);
  if (typeof search === 'string') products=products.filter(p=>[p.name,p.slug,p.tagline].join(' ').toLowerCase().includes(search.slice(0,200).toLowerCase()));
  res.json({success:true,products,metrics:await metrics()});
}));
adminMarketplaceRouter.post('/products',handle(async(req,res)=>{
  const input = await validateProductInput(req.body || {});
  const saved=await MarketplaceStore.createProduct(input as Parameters<typeof MarketplaceStore.createProduct>[0],req.user!.id);
  res.status(201).json({success:true,product:await adminProduct(saved)});
}));
adminMarketplaceRouter.patch('/products/:id',handle(async(req,res)=>{
  const existing=await MarketplaceStore.getProductById(req.params.id); if(!existing) throw new MarketplaceInputError('Product not found.',404);
  const input=await validateProductInput(req.body || {},existing);
  res.json({success:true,product:await adminProduct(await MarketplaceStore.updateProduct(existing.id,input,req.user!.id))});
}));
for (const action of ['publish','unpublish','feature','unfeature','archive','restore','duplicate']) adminMarketplaceRouter.post(`/products/:id/${action}`,handle(async(req,res)=>{
  const existing=await MarketplaceStore.getProductById(req.params.id); if(!existing) throw new MarketplaceInputError('Product not found.',404);
  const admin=req.user!.id;
  if(action==='publish') await validateProductInput({published:true,confirmWarnings:req.body?.confirmWarnings},existing);
  const saved=action==='duplicate' ? await MarketplaceStore.duplicateProduct(existing.id,admin) : action==='restore' ? await MarketplaceStore.restoreProduct(existing.id,admin) : action==='archive' ? await MarketplaceStore.archiveProduct(existing.id,admin) : action==='feature'||action==='unfeature' ? await MarketplaceStore.setFeatured(existing.id,action==='feature',admin) : await MarketplaceStore.setPublished(existing.id,action==='publish',admin);
  res.json({success:true,product:await adminProduct(saved)});
}));
adminMarketplaceRouter.get('/categories',handle(async(_req,res)=>{res.json({success:true,categories:await MarketplaceControlStore.getCategories()});}));
adminMarketplaceRouter.post('/categories',handle(async(req,res)=>{res.status(201).json({success:true,category:await MarketplaceControlStore.saveCategory(req.body || {},req.user!.id)});}));
adminMarketplaceRouter.patch('/categories/:slug',handle(async(req,res)=>{res.json({success:true,category:await MarketplaceControlStore.saveCategory(req.body || {},req.user!.id,req.params.slug)});}));
adminMarketplaceRouter.get('/inquiries',handle(async(req,res)=>{res.json({success:true,...await MarketplaceControlStore.listInquiries({status:typeof req.query.status==='string'?req.query.status:undefined,productId:typeof req.query.productId==='string'?req.query.productId:undefined,search:typeof req.query.search==='string'?req.query.search:undefined,page:req.query.page?Number(req.query.page):1,pageSize:req.query.pageSize?Number(req.query.pageSize):20})});}));
adminMarketplaceRouter.patch('/inquiries/:id',handle(async(req,res)=>{res.json({success:true,inquiry:await MarketplaceControlStore.updateInquiry(req.params.id,req.body || {},req.user!.id)});}));

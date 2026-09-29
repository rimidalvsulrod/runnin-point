const state = { products: [], cart: JSON.parse(localStorage.getItem('rp-cart') || '[]'), category: 'All', settings: { shipping_cents: 0, currency: 'usd' } };
const $ = s => document.querySelector(s);
const money = cents => new Intl.NumberFormat('en-US', { style: 'currency', currency: state.settings.currency.toUpperCase() }).format(cents / 100);
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

function toast(message) { const el=$('#toast'); el.textContent=message; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),2200); }
function openCart(open=true){ $('#cart').classList.toggle('open',open); $('#scrim').classList.toggle('show',open); }
function saveCart(){ localStorage.setItem('rp-cart',JSON.stringify(state.cart)); renderCart(); }

function renderFilters(){
  const categories=['All',...new Set(state.products.map(p=>p.category))];
  $('#filters').innerHTML=categories.map(c=>`<button class="filter ${c===state.category?'active':''}" data-category="${escapeHtml(c)}">${escapeHtml(c)}</button>`).join('');
}
function renderProducts(){
  const products=state.category==='All'?state.products:state.products.filter(p=>p.category===state.category);
  $('#productCount').textContent=`${products.length} piece${products.length===1?'':'s'}`;
  $('#products').innerHTML=products.length?products.map(p=>`<article class="product">
    ${p.featured?'<span class="tag">Featured</span>':''}<div class="product-media">${p.image_url?`<img src="${escapeHtml(p.image_url)}" alt="${escapeHtml(p.name)}">`:'<div class="product-placeholder">r.</div>'}</div>
    <div class="product-body"><div class="product-meta"><h2>${escapeHtml(p.name)}</h2><span class="price">${money(p.price_cents)}</span></div><p>${escapeHtml(p.description)}</p>
    <div class="product-actions">${p.variants.length?`<select aria-label="Choose option" id="variant-${p.id}">${p.variants.map(v=>`<option>${escapeHtml(v)}</option>`).join('')}</select>`:''}<button class="button" data-add="${p.id}">Add</button></div></div></article>`).join(''):'<div class="empty">Nothing is available in this collection yet.</div>';
}
function renderCart(){
  state.cart=state.cart.filter(item=>state.products.some(p=>p.id===item.product_id));
  const count=state.cart.reduce((n,i)=>n+i.quantity,0); $('#cartCount').textContent=count;
  $('#cartItems').innerHTML=state.cart.length?state.cart.map((item,index)=>{const p=state.products.find(x=>x.id===item.product_id);return `<div class="cart-item">${p.image_url?`<img src="${escapeHtml(p.image_url)}" alt="">`:'<div class="mini"></div>'}<div><b>${escapeHtml(p.name)}</b><small>${item.variant?escapeHtml(item.variant)+' · ':''}Qty ${item.quantity}</small><small>${money(p.price_cents*item.quantity)}</small></div><button class="remove" data-remove="${index}" aria-label="Remove">×</button></div>`}).join(''):'<div class="empty">Your cart is empty.</div>';
  const subtotal=state.cart.reduce((sum,item)=>{const p=state.products.find(x=>x.id===item.product_id);return sum+(p?.price_cents||0)*item.quantity},0);
  $('#subtotal').textContent=money(subtotal); $('#shipping').textContent=state.settings.shipping_cents?money(state.settings.shipping_cents):'Free'; $('#total').textContent=money(subtotal+(state.cart.length?state.settings.shipping_cents:0)); $('#checkout').disabled=!state.cart.length;
}
const DEMO_PRODUCTS=[
  {id:'11111111-1111-4111-8111-111111111111',name:'Point Study No. 01',description:'Original mixed-media basketball study on heavyweight paper.',price_cents:18000,image_url:'',category:'Original Art',variants:['Original'],inventory:1,active:true,featured:true},
  {id:'22222222-2222-4222-8222-222222222222',name:'Run the Floor Print',description:'Archival art print. Signed and numbered in a limited run.',price_cents:4500,image_url:'',category:'Prints',variants:['11 × 14','18 × 24'],inventory:24,active:true,featured:false},
  {id:'33333333-3333-4333-8333-333333333333',name:'Runnin’ Point Tee',description:'Heavyweight cotton tee with the point mark front and center.',price_cents:3800,image_url:'',category:'Merch',variants:['S','M','L','XL','2XL'],inventory:40,active:true,featured:false}
];
async function load(){
  try{const [pr,sr]=await Promise.all([fetch('/api/products').then(async r=>{if(!r.ok)throw new Error();return r.json()}),fetch('/api/settings').then(async r=>{if(!r.ok)throw new Error();return r.json()})]); state.products=pr.products||[]; state.settings={...state.settings,...sr.settings};}catch{state.products=DEMO_PRODUCTS;state.settings={...state.settings,store_description:'Preview collection — connect the store database to publish real products.',shipping_cents:0};toast('Preview mode — checkout is not live yet')}$('#storeDescription').textContent=state.settings.store_description;renderFilters();renderProducts();renderCart(); const q=new URLSearchParams(location.search);if(q.get('checkout')==='success'){state.cart=[];saveCart();toast('Order confirmed — thank you!')}
}
document.addEventListener('click',e=>{const add=e.target.closest('[data-add]'),remove=e.target.closest('[data-remove]'),filter=e.target.closest('[data-category]');if(add){const p=state.products.find(x=>x.id===add.dataset.add),variant=$(`#variant-${p.id}`)?.value||'';const existing=state.cart.find(i=>i.product_id===p.id&&i.variant===variant);if(existing)existing.quantity=Math.min(existing.quantity+1,p.inventory);else state.cart.push({product_id:p.id,quantity:1,variant});saveCart();toast('Added to cart')}if(remove){state.cart.splice(+remove.dataset.remove,1);saveCart()}if(filter){state.category=filter.dataset.category;renderFilters();renderProducts()}});
$('#cartButton').onclick=()=>openCart();$('#closeCart').onclick=()=>openCart(false);$('#scrim').onclick=()=>openCart(false);
$('#checkout').onclick=async()=>{const b=$('#checkout');b.disabled=true;b.textContent='Opening checkout…';try{const r=await fetch('/api/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items:state.cart})});const d=await r.json();if(!r.ok)throw new Error(d.error);location.href=d.url}catch(error){toast(error.message||'Checkout is unavailable');b.disabled=false;b.textContent='Secure checkout'}};
load();


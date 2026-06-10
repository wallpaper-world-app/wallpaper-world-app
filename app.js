// FIREBASE CONFIGURATION 
const firebaseConfig = {
    apiKey: "AIzaSyANhZRelI5tmdLHU6k6-Zs46PflKMZxIhk",
    authDomain: "wallpaper-world1.firebaseapp.com",
    projectId: "wallpaper-world1",
    storageBucket: "wallpaper-world1.firebasestorage.app",
    messagingSenderId: "284849175361",
    appId: "1:284849175361:web:8d624245c2b638fe6abfc0"
};

// INITIALIZE FIREBASE
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// LOCAL VARIABLES 
let users = {};
let referrals = [];
let storeItems = [];
let orders = [];
let currentUser = localStorage.getItem('ww_current_user') || null;

const ADMIN_ID = "sultan7151";
const ADMIN_PASS = "S@7151221s";

// HELPER FUNCTION: INSTANT COPY TO CLIPBOARD
function copyText(text) {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
        alert("📋 Copied to clipboard: " + text);
    }).catch(err => {
        // Fallback approach for in-app browsers
        const el = document.createElement('textarea');
        el.value = text;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        alert("📋 Copied to clipboard: " + text);
    });
}

// === AUTOMATIC PAYMENT VERIFICATION LOGIC (LEGACY INSTAMOJO CHECK) ===
async function checkPaymentStatus() {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('payment_status');
    const paymentId = urlParams.get('payment_id');
    
    if (paymentStatus === 'Credit') {
        const pUser = localStorage.getItem('pendingOrder_user');
        const pItem = localStorage.getItem('pendingOrder_item');
        
        if (pUser && pItem) {
            setTimeout(async () => {
                const item = storeItems.find(i => i.id === pItem);
                if (item) {
                    const newOrder = {
                        orderId: paymentId || ('ORD_' + Date.now()),
                        buyer: pUser, itemId: pItem, itemName: item.name, 
                        price: item.price, utr: paymentId || 'Instamojo', status: 'pending', date: new Date().toLocaleString()
                    };
                    
                    await db.collection('orders').doc(newOrder.orderId).set(newOrder);
                    orders.push(newOrder);
                    alert("✅ Payment Successful! Your order has been placed. Admin will verify it shortly.");
                    
                    localStorage.removeItem('pendingOrder_user');
                    localStorage.removeItem('pendingOrder_item');
                    
                    window.history.replaceState({}, document.title, window.location.pathname);
                }
            }, 3000); 
        }
    } else if (paymentStatus === 'Failed') {
        alert("❌ Payment Failed. Please try again.");
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}
checkPaymentStatus();

// DATABASE SE DATA FETCH KARNA
async function loadDataFromFirebase() {
    try {
        const uSnap = await db.collection('users').get();
        uSnap.forEach(doc => { users[doc.id] = doc.data(); });

        const rSnap = await db.collection('referrals').get();
        rSnap.forEach(doc => { referrals.push(doc.data()); });

        const sSnap = await db.collection('store').get();
        sSnap.forEach(doc => { storeItems.push(doc.data()); });

        const oSnap = await db.collection('orders').get();
        oSnap.forEach(doc => { orders.push(doc.data()); });

        if (currentUser) {
            if (currentUser === 'admin_master' || currentUser === ADMIN_ID) {
                loadAdminDashboard();
            } else if (users[currentUser] && !users[currentUser].isBanned) {
                loadDashboard();
            } else {
                logout();
            }
        }
    } catch (error) {
        console.error("Firebase Error: ", error);
        alert("Database load error. Internet connection check karein.");
    }
}
loadDataFromFirebase(); 

// UI Toggles
function switchTab(type) {
    document.getElementById('login-form').classList.toggle('hidden', type !== 'login');
    document.getElementById('register-form').classList.toggle('hidden', type !== 'register');
    document.getElementById('tab-login').classList.toggle('active', type === 'login');
    document.getElementById('tab-register').classList.toggle('active', type === 'register');
}

function switchUserTab(type) {
    document.getElementById('view-store').classList.toggle('hidden', type !== 'store');
    document.getElementById('view-wallet').classList.toggle('hidden', type !== 'wallet');
    document.getElementById('view-purchases').classList.toggle('hidden', type !== 'purchases');
    document.getElementById('view-profile').classList.toggle('hidden', type !== 'profile');
    
    document.getElementById('nav-store').classList.toggle('active', type === 'store');
    document.getElementById('nav-wallet').classList.toggle('active', type === 'wallet');
    document.getElementById('nav-purchases').classList.toggle('active', type === 'purchases');
    document.getElementById('nav-profile').classList.toggle('active', type === 'profile');
    
    if(type === 'profile') loadProfileData();
}

// Authentication
function handleRegister(event) {
    event.preventDefault();
    const name = document.getElementById('reg-name').value.trim();
    const instaId = document.getElementById('reg-insta').value.trim().toLowerCase();
    const password = document.getElementById('reg-pass').value.trim();
    const upiId = document.getElementById('reg-upi').value.trim();
    const age = document.getElementById('reg-age').value;
    const work = document.getElementById('reg-work').value.trim();
    const referrerId = document.getElementById('reg-referrer').value.trim().toLowerCase();

    if (work.toLowerCase() === 'student') { alert('❌ Students are not eligible for this program.'); return; }
    if (users[instaId] || instaId === ADMIN_ID) { alert('❌ This Instagram ID is already registered!'); return; }
    if (referrerId && !users[referrerId]) { alert('❌ Invalid Referrer ID.'); return; }

    const currentDateTime = new Date().toLocaleString();
    const newUser = {
        name: name, instaId: instaId, password: password, upiId: upiId, age: age, work: work,
        referredBy: referrerId || null, purchaseValue: 0, withdrawalCount: 0, withdrawalRequested: false, 
        withdrawalRequestTime: null, isBanned: false, tcAgreedAt: currentDateTime 
    };

    db.collection('users').doc(instaId).set(newUser).then(() => {
        users[instaId] = newUser;
        alert('✅ Account created successfully! Please log in.');
        switchTab('login');
    });
}

// Login logic mapping
function handleLogin(event) {
    event.preventDefault();
    const instaId = document.getElementById('login-insta').value.trim().toLowerCase();
    const password = document.getElementById('login-pass').value.trim();

    if (instaId === ADMIN_ID && password === ADMIN_PASS) {
        currentUser = 'admin_master';
        localStorage.setItem('ww_current_user', currentUser);
        loadAdminDashboard(); return;
    }
    if (!users[instaId]) { alert('❌ ID not found! Please register first.'); return; }
    if (users[instaId].isBanned) { alert('🚫 Your account has been BANNED. Contact support.'); return; }
    if (users[instaId].password !== password) { alert('❌ Incorrect Password!'); return; }

    currentUser = instaId;
    localStorage.setItem('ww_current_user', currentUser);
    loadDashboard();
}

// Forgot Password
function openForgotPassModal() { document.getElementById('forgot-pass-modal').classList.remove('hidden'); }
function closeForgotPassModal() { document.getElementById('forgot-pass-modal').classList.add('hidden'); }

function handleForgotPassword(event) {
    event.preventDefault();
    const insta = document.getElementById('fg-insta').value.trim().toLowerCase();
    const upi = document.getElementById('fg-upi').value.trim();
    const newPass = document.getElementById('fg-newpass').value.trim();

    if (!users[insta]) { alert("❌ User not found!"); return; }
    if (users[insta].upiId !== upi) { alert("❌ Verification failed! The UPI ID does not match."); return; }

    db.collection('users').doc(insta).update({ password: newPass }).then(() => {
        users[insta].password = newPass;
        alert("✅ Password successfully reset! You can now log in.");
        closeForgotPassModal();
    });
}

// User Dashboard & Store
function loadDashboard() {
    if (currentUser === 'admin_master') { loadAdminDashboard(); return; }
    document.getElementById('auth-section').classList.add('hidden');
    document.getElementById('dashboard-section').classList.remove('hidden');
    document.getElementById('user-display-name').innerText = users[currentUser].name;
    document.getElementById('share-link').value = currentUser;

    renderStore();
    renderMyDownloads();
    renderReferralsAndWallet();
}

function loadProfileData() {
    const user = users[currentUser];
    document.getElementById('prof-insta').value = user.instaId;
    document.getElementById('prof-name').value = user.name;
    document.getElementById('prof-upi').value = user.upiId;
    document.getElementById('prof-age').value = user.age;
    document.getElementById('prof-work').value = user.work;
    document.getElementById('prof-pass').value = ""; 
}

function renderStore() {
    const container = document.getElementById('store-items-container');
    container.innerHTML = '';
    const myBoughtIds = orders.filter(o => o.buyer === currentUser && o.status === 'approved').map(o => o.itemId);

    storeItems.forEach(item => {
        const div = document.createElement('div');
        div.className = 'store-item';
        if (myBoughtIds.includes(item.id)) {
            div.innerHTML = `<img src="${item.imgUrl}"><h5>${item.name}</h5><p>Purchased</p><a href="${item.driveLink}" target="_blank" class="btn-dl">Download HD</a>`;
        } else {
            div.innerHTML = `<img src="${item.imgUrl}"><h5>${item.name}</h5><p>₹${item.price}</p><button class="btn-buy" onclick="payWithRazorpay('${item.id}', ${item.price})">Buy Now</button>`;
        }
        container.appendChild(div);
    });
}

// Razorpay Order Creation and Modal Management Frontend Flow (AUTOMATED & SECURE)
async function payWithRazorpay(itemId, price) {
    if (!currentUser) { alert("Please log in to purchase wallpapers."); return; }
    
    const amountInPaise = price * 100;
    const item = storeItems.find(i => i.id === itemId);

    try {
        const orderResponse = await fetch('/api/create-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: amountInPaise, receipt: 'rcpt_' + itemId })
        });

        const orderData = await orderResponse.json();
        if (!orderResponse.ok) { alert('Order Error: ' + orderData.error); return; }

        const options = {
            key: "rzp_live_SzXXGobm5zLdcN", 
            amount: orderData.amount,
            currency: orderData.currency,
            name: "Wallpaper World",
            description: `Purchase Premium: ${item.name}`,
            order_id: orderData.order_id,
            handler: async function (response) {
                const verifyResponse = await fetch('/api/verify-payment', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        razorpay_order_id: response.razorpay_order_id,
                        razorpay_payment_id: response.razorpay_payment_id,
                        razorpay_signature: response.razorpay_signature
                    })
                });

                const verifyData = await verifyResponse.json();

                if (verifyResponse.ok && verifyData.status === 'success') {
                    const newOrderId = response.razorpay_order_id;
                    const newOrder = {
                        orderId: newOrderId,
                        buyer: currentUser, 
                        itemId: itemId, 
                        itemName: item.name, 
                        price: item.price, 
                        utr: response.razorpay_payment_id, 
                        status: 'approved', 
                        date: new Date().toLocaleString()
                    };
                    
                    await db.collection('orders').doc(newOrderId).set(newOrder);
                    orders.push(newOrder);
                    
                    const buyerObj = users[currentUser];
                    if (buyerObj) {
                        if (item.price > buyerObj.purchaseValue) {
                            await db.collection('users').doc(currentUser).update({ purchaseValue: item.price });
                            buyerObj.purchaseValue = item.price;
                            
                            referrals.forEach(ref => {
                                if (ref.referredBy === currentUser && ref.status === 'on_hold' && item.price >= ref.price) {
                                    ref.status = 'success'; 
                                    db.collection('referrals').doc(ref.id).update({ status: 'success' });
                                }
                            });
                        }

                        if (buyerObj.referredBy) {
                            const referrerObj = users[buyerObj.referredBy];
                            if (referrerObj) {
                                const commStatus = (item.price > referrerObj.purchaseValue) ? 'on_hold' : 'success';
                                const newRef = { 
                                    id: 'REF_' + Date.now(), 
                                    referredBy: buyerObj.referredBy, 
                                    buyer: currentUser, 
                                    price: item.price, 
                                    bonus: item.price * 0.50, 
                                    status: commStatus 
                                };
                                referrals.push(newRef);
                                await db.collection('referrals').doc(newRef.id).set(newRef);
                            }
                        }
                    }
                    
                    alert("✅ Payment Successful! Your wallpaper is ready to download.");
                    renderStore();
                    renderMyDownloads();
                    if(currentUser === 'admin_master' || currentUser === ADMIN_ID) { loadAdminDashboard(); }
                } else {
                    alert('Payment Security Verification Failed: ' + verifyData.message);
                }
            },
            modal: {
                ondismiss: function () { console.log('Payment checkout window was closed by user.'); }
            },
            theme: { color: "#63b3ed" }
        };

        const rzp = new Razorpay(options);
        rzp.on('payment.failed', function (response) {
            alert('Transaction Declined: ' + response.error.description);
        });
        rzp.open();

    } catch (error) {
        console.error('Razorpay Setup Error:', error);
        alert('Server connection timeout. Kripya dobara koshish karein.');
    }
}

function redirectToInstamojo(itemId, url) { payWithRazorpay(itemId, 10); }

function handleUpdateProfile(event) {
    event.preventDefault();
    const name = document.getElementById('prof-name').value.trim();
    const upi = document.getElementById('prof-upi').value.trim();
    const age = document.getElementById('prof-age').value;
    const work = document.getElementById('prof-work').value.trim();
    const newPass = document.getElementById('prof-pass').value.trim();

    const updates = { name: name, upiId: upi, age: age, work: work };
    if (newPass !== "") updates.password = newPass;

    db.collection('users').doc(currentUser).update(updates).then(() => {
        users[currentUser] = { ...users[currentUser], ...updates };
        document.getElementById('user-display-name').innerText = name;
        alert("✅ Profile updated successfully!");
    });
}

function renderMyDownloads() {
    const container = document.getElementById('my-downloads-list');
    container.innerHTML = '';
    const myBoughtIds = orders.filter(o => o.buyer === currentUser && o.status === 'approved').map(o => o.itemId);
    if (myBoughtIds.length === 0) { container.innerHTML = '<p style="color:var(--text-muted); font-size:0.9rem; grid-column: span 2;">No purchases made yet.</p>'; return; }

    storeItems.forEach(item => {
        if (myBoughtIds.includes(item.id)) {
            const div = document.createElement('div');
            div.className = 'store-item';
            div.innerHTML = `<img src="${item.imgUrl}"><h5>${item.name}</h5><a href="${item.driveLink}" target="_blank" class="btn-dl">Download HD</a>`;
            container.appendChild(div);
        }
    });
}

function renderReferralsAndWallet() {
    const userObj = users[currentUser];
    const tableBody = document.getElementById('referral-list-rows');
    tableBody.innerHTML = '';

    let totalPendingBonus = 0; let successfulCount = 0;
    const myReferrals = referrals.filter(ref => ref.referredBy === currentUser);

    myReferrals.forEach(ref => {
        const row = document.createElement('tr');
        let statusClass = 'status-pending';
        if (ref.status === 'success') { statusClass = 'status-success'; successfulCount++; totalPendingBonus += ref.bonus; } 
        else if (ref.status === 'credited') { statusClass = 'status-credited'; } 
        else if (ref.status === 'on_hold') { statusClass = 'status-pending'; }

        row.innerHTML = `<td>${ref.buyer}</td><td>₹${ref.price}</td><td>₹${ref.bonus}</td><td class="${statusClass}">${ref.status.toUpperCase()}</td>`;
        tableBody.appendChild(row);
    });

    document.getElementById('wallet-amount').innerText = totalPendingBonus;
    const wBtn = document.getElementById('withdraw-btn');
    const wMsg = document.getElementById('withdraw-msg');

    if (userObj.withdrawalRequested) { wBtn.classList.add('hidden'); wMsg.innerText = "⏳ Payout request is pending."; return; }

    if (userObj.withdrawalCount === 0) {
        if (successfulCount >= 2 && totalPendingBonus > 0) { wBtn.classList.remove('hidden'); wMsg.innerText = "You are eligible to withdraw!"; } 
        else { wBtn.classList.add('hidden'); wMsg.innerText = `Minimum 2 successful referrals required. Current: ${successfulCount}`; }
    } else {
        if (totalPendingBonus > 0) { wBtn.classList.remove('hidden'); wMsg.innerText = "Balance ready for withdrawal."; } 
        else { wBtn.classList.add('hidden'); wMsg.innerText = "Need new verified referrals."; }
    }
}

function requestWithdrawal() {
    const timeNow = Date.now();
    db.collection('users').doc(currentUser).update({ withdrawalRequested: true, withdrawalRequestTime: timeNow }).then(() => {
        users[currentUser].withdrawalRequested = true;
        users[currentUser].withdrawalRequestTime = timeNow;
        alert(`💸 Request Submitted! Added to the payout queue.`);
        renderReferralsAndWallet();
    });
}

// ==========================================================
// 👑 SUPER ADMIN SECTION (WITH AUTOMATED DATA BREAKDOWNS)
// ==========================================================
function loadAdminDashboard() {
    document.getElementById('auth-section').classList.add('hidden');
    document.getElementById('admin-dashboard').classList.remove('hidden');
    
    const todayDateStr = new Date().toLocaleDateString();
    let lifeEarn = 0, todayEarn = 0, pendBonus = 0, sentBonus = 0;
    
    orders.forEach(o => {
        if (o.status === 'approved') {
            lifeEarn += o.price;
            if (o.date.split(',')[0].trim() === todayDateStr) { todayEarn += o.price; }
        }
    });
    
    // Group active success bonuses by referrer to create a visual breakdown map
    let activeBonusBreakdown = {};
    referrals.forEach(ref => {
        if (ref.status === 'success') { 
            pendBonus += ref.bonus; 
            if (!activeBonusBreakdown[ref.referredBy]) { activeBonusBreakdown[ref.referredBy] = 0; }
            activeBonusBreakdown[ref.referredBy] += ref.bonus;
        }
        if (ref.status === 'credited') { sentBonus += ref.bonus; }
    });

    document.getElementById('stat-life-earn').innerText = lifeEarn;
    document.getElementById('stat-today-earn').innerText = todayEarn;
    document.getElementById('stat-pend-bonus').innerText = pendBonus;
    document.getElementById('stat-sent-bonus').innerText = sentBonus;

    // --- DYNAMICALLY INJECT PENDING BONUS BREAKDOWN TABLE IF NOT EXISTS ---
    let breakdownHTML = `
        <div id="admin-bonus-breakdown-container" style="background:#1a202c; border:1px solid #2d3748; padding:15px; border-radius:8px; margin-top:20px; margin-bottom:20px;">
            <h4 style="color:#ed8936; margin-top:0; margin-bottom:12px; font-size:1.1rem;">📋 Pending Bonus User Breakdown (Total: ₹${pendBonus})</h4>
            <table style="width:100%; border-collapse:collapse; text-align:left; font-size:0.9rem;">
                <thead>
                    <tr style="border-bottom:2px solid #2d3748; color:#a0aec0;">
                        <th style="padding:8px;">Insta / User ID</th>
                        <th style="padding:8px;">Full Name</th>
                        <th style="padding:8px;">UPI ID</th>
                        <th style="padding:8px;">Hold Amount</th>
                    </tr>
                </thead>
                <tbody>
    `;

    const bonusUserKeys = Object.keys(activeBonusBreakdown);
    if (bonusUserKeys.length === 0) {
        breakdownHTML += `<tr><td colspan="4" style="padding:10px; color:#a0aec0; text-align:center;">No users hold an active pending balance yet.</td></tr>`;
    } else {
        bonusUserKeys.forEach(uId => {
            const uObj = users[uId] || { name: 'Unknown Account', upiId: 'N/A' };
            breakdownHTML += `
                <tr style="border-bottom:1px solid #2d3748;">
                    <td style="padding:8px;"><strong>${uId}</strong></td>
                    <td style="padding:8px;">${uObj.name}</td>
                    <td style="padding:8px;">
                        <span style="font-family:monospace; background:#2d3748; padding:2px 6px; border-radius:4px; color:#cbd5e0;">${uObj.upiId}</span>
                        ${uObj.upiId !== 'N/A' ? `<button onclick="copyText('${uObj.upiId}')" style="background:#3182ce; color:#fff; padding:3px 8px; margin-left:6px; border:none; border-radius:4px; cursor:pointer; font-size:0.75rem; font-weight:bold;">Copy</button>` : ''}
                    </td>
                    <td style="padding:8px; color:#ed8936; font-weight:bold; font-size:1rem;">₹${activeBonusBreakdown[uId]}</td>
                </tr>
            `;
        });
    }
    breakdownHTML += `</tbody></table></div>`;

    // Inject breakdown segment dynamically directly inside the view layout
    let existingSection = document.getElementById('admin-bonus-breakdown-container');
    if (existingSection) {
        existingSection.outerHTML = breakdownHTML;
    } else {
        const insertionTarget = document.getElementById('admin-orders-list') || document.getElementById('admin-withdrawal-list');
        if (insertionTarget) {
            const parentTableElement = insertionTarget.closest('table') || insertionTarget;
            parentTableElement.insertAdjacentHTML('beforebegin', breakdownHTML);
        }
    }

    // Render Orders Table
    const ordersTable = document.getElementById('admin-orders-list');
    ordersTable.innerHTML = '';
    orders.filter(o => o.status === 'pending').forEach(o => {
        const row = document.createElement('tr');
        row.innerHTML = `<td>${o.buyer}</td><td>${o.itemName}</td><td>₹${o.price}</td><td style="font-size:0.8rem;">${o.utr}</td>
        <td><button onclick="approveOrder('${o.orderId}')" style="background:#48bb78; color:#fff; padding:5px; border:none; cursor:pointer; border-radius:4px;">Approve</button></td>`;
        ordersTable.appendChild(row);
    });

    // Render Withdrawal Queue with Names, IDs, and Instant Copy Mechanism
    const adminWithdrawalTable = document.getElementById('admin-withdrawal-list');
    adminWithdrawalTable.innerHTML = '';
    
    let pendingReqs = [];
    let todayReqCount = 0;
    Object.keys(users).forEach(id => {
        if (users[id].withdrawalRequested && !users[id].isBanned) {
            pendingReqs.push({ id: id, time: users[id].withdrawalRequestTime || 0 });
            
            const reqDateStr = new Date(users[id].withdrawalRequestTime).toLocaleDateString();
            if(reqDateStr === todayDateStr) { todayReqCount++; }
        }
    });
    pendingReqs.sort((a, b) => a.time - b.time);

    document.getElementById('stat-total-req').innerText = pendingReqs.length;
    document.getElementById('stat-today-req').innerText = todayReqCount;

    pendingReqs.forEach(req => {
        const userId = req.id;
        const uObj = users[userId] || { name: 'N/A', upiId: 'N/A' };
        const dateObj = new Date(req.time);
        const timeStr = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString();
        let payAmount = 0;
        referrals.forEach(ref => { if (ref.referredBy === userId && ref.status === 'success') payAmount += ref.bonus; });

        const row = document.createElement('tr');
        row.innerHTML = `
            <td style="font-size:0.8rem;">${timeStr}</td>
            <td><strong>${userId}</strong><br><span style="font-size:0.8rem; color:#a0aec0;">(${uObj.name})</span></td>
            <td>
                <span style="font-family:monospace; background:#2d3748; padding:3px 6px; border-radius:4px; color:#cbd5e0; font-size:0.85rem;">${uObj.upiId}</span>
                <button onclick="copyText('${uObj.upiId}')" style="background:#3182ce; color:#fff; padding:3px 8px; margin-left:6px; border:none; border-radius:4px; cursor:pointer; font-size:0.75rem; font-weight:bold;">Copy UPI</button>
            </td>
            <td style="color:#00ff88; font-weight:bold; font-size:1rem;">₹${payAmount}</td>
            <td><button onclick="payFromModal('${userId}')" style="background:#48bb78; color:#fff; padding:5px; border:none; border-radius:4px; cursor:pointer;">Pay User</button></td>
        `;
        adminWithdrawalTable.appendChild(row);
    });

    const allUsersTable = document.getElementById('admin-all-users-list');
    allUsersTable.innerHTML = '';
    Object.keys(users).forEach(userId => {
        const u = users[userId];
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${userId}</td>
            <td>₹${u.purchaseValue}</td>
            <td style="font-size:0.75rem;">${u.tcAgreedAt}</td>
            <td><button onclick="viewUserDetails('${userId}')" style="background:var(--border-color); color:#fff; padding:5px 10px; border:none; border-radius:4px; cursor:pointer;">Manage</button></td>
        `;
        allUsersTable.appendChild(row);
    });

    const adminStoreList = document.getElementById('admin-store-list');
    if (adminStoreList) {
        adminStoreList.innerHTML = '';
        storeItems.forEach(item => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><img src="${item.imgUrl}" style="width: 40px; height: 40px; object-fit: cover; border-radius: 4px;"></td>
                <td>${item.name}</td>
                <td>₹${item.price}</td>
                <td><button onclick="deleteWallpaper('${item.id}')" style="background:#e53e3e; color:#fff; padding:5px 10px; border:none; border-radius:4px; cursor:pointer;">Delete</button></td>
            `;
            adminStoreList.appendChild(row);
        });
    }
}

function adminAddWallpaper() {
    const name = document.getElementById('adm-wall-name').value.trim();
    const price = document.getElementById('adm-wall-price').value.trim();
    const img = document.getElementById('adm-wall-img').value.trim();
    const drive = document.getElementById('adm-wall-drive').value.trim();
    const instamojoUrl = document.getElementById('adm-wall-instamojo').value.trim(); 

    if(!name || !price || !img || !drive) { alert("Please fill all mandatory fields (Title, Price, Image, Drive Link)!"); return; }

    const newItem = { 
        id: 'W_' + Date.now(), 
        name: name, 
        price: parseFloat(price), 
        imgUrl: img, 
        driveLink: drive,
        instamojoLink: instamojoUrl || 'razorpay' 
    };
    
    db.collection('store').doc(newItem.id).set(newItem).then(() => {
        storeItems.push(newItem);
        alert("✅ Wallpaper successfully added to the store!");
        document.getElementById('adm-wall-name').value = '';
        document.getElementById('adm-wall-price').value = '';
        document.getElementById('adm-wall-img').value = '';
        document.getElementById('adm-wall-drive').value = '';
        document.getElementById('adm-wall-instamojo').value = ''; 
        loadAdminDashboard();
        renderStore();
    });
}

function approveOrder(orderId) {
    const orderIndex = orders.findIndex(o => o.orderId === orderId);
    if(orderIndex === -1) return;
    
    const order = orders[orderIndex];
    const buyerId = order.buyer;
    const buyerObj = users[buyerId];
    const price = order.price;

    db.collection('orders').doc(orderId).update({ status: 'approved' }).then(() => {
        order.status = 'approved';
        
        if(price > buyerObj.purchaseValue) {
            db.collection('users').doc(buyerId).update({ purchaseValue: price });
            buyerObj.purchaseValue = price;
            
            referrals.forEach(ref => {
                if (ref.referredBy === buyerId && ref.status === 'on_hold' && price >= ref.price) {
                    ref.status = 'success'; 
                    db.collection('referrals').doc(ref.id).update({ status: 'success' });
                }
            });
        }

        if (buyerObj.referredBy) {
            const referrerObj = users[buyerObj.referredBy];
            if (referrerObj) {
                const commStatus = (price > referrerObj.purchaseValue) ? 'on_hold' : 'success';
                const newRef = { id: 'REF_' + Date.now(), referredBy: buyerObj.referredBy, buyer: buyerId, price: price, bonus: price * 0.50, status: commStatus };
                referrals.push(newRef);
                db.collection('referrals').doc(newRef.id).set(newRef);
            }
        }
        alert("✅ Payment Approved! Limit upgraded & Commission settled automatically.");
        loadAdminDashboard();
    });
}

function payFromModal(userId) {
    if(confirm(`Confirm payment to ${userId}?`)){
        referrals.forEach(ref => { 
            if (ref.referredBy === userId && ref.status === 'success') {
                ref.status = 'credited';
                db.collection('referrals').doc(ref.id).update({ status: 'credited' });
            } 
        });
        
        db.collection('users').doc(userId).update({
            withdrawalRequested: false, withdrawalCount: users[userId].withdrawalCount + 1, withdrawalRequestTime: null
        }).then(() => {
            users[userId].withdrawalRequested = false;
            users[userId].withdrawalCount += 1;
            users[userId].withdrawalRequestTime = null;
            loadAdminDashboard();
        });
    }
}

// Modal Closures & Utilities
function viewUserDetails(userId) {
    const user = users[userId];
    document.getElementById('modal-user-title').innerText = userId;
    document.getElementById('mod-name').innerText = user.name;
    document.getElementById('mod-upi').innerText = user.upiId;
    document.getElementById('mod-limit').innerText = user.purchaseValue;
    document.getElementById('mod-tc').innerText = user.tcAgreedAt;
    document.getElementById('mod-status').innerHTML = user.isBanned ? '<span style="color:red;">BANNED</span>' : '<span style="color:green;">ACTIVE</span>';
    
    const modalActions = document.getElementById('modal-actions');
    const banText = user.isBanned ? 'Unban Account' : 'Ban Account';
    modalActions.innerHTML = `<button onclick="toggleBanUser('${userId}')" style="background:var(--border-color); color:white; padding:10px; cursor:pointer;">${banText}</button>`;
    document.getElementById('user-modal').classList.remove('hidden');
}

function toggleBanUser(userId) {
    const newStatus = !users[userId].isBanned;
    db.collection('users').doc(userId).update({ isBanned: newStatus }).then(() => {
        users[userId].isBanned = newStatus;
        alert(newStatus ? 'User Banned!' : 'User Activated!');
        closeAdminModal(); loadAdminDashboard();
    });
}

function deleteWallpaper(itemId) {
    if (confirm("Are you sure you want to delete this wallpaper? Naye customers ise nahi dekh payenge.")) {
        db.collection('store').doc(itemId).delete().then(() => {
            storeItems = storeItems.filter(item => item.id !== itemId);
            alert("🗑️ Wallpaper successfully deleted!");
            loadAdminDashboard();
            renderStore();
        }).catch(error => {
            console.error("Error deleting wallpaper: ", error);
            alert("Failed to delete wallpaper. Check connection.");
        });
    }
}

function closeAdminModal() { document.getElementById('user-modal').classList.add('hidden'); }
function logout() { currentUser = null; localStorage.removeItem('ww_current_user'); location.reload(); }
function copyLink() {
    const linkInput = document.getElementById('share-link');
    linkInput.select(); document.execCommand("copy");
    alert("Copied: " + linkInput.value);
}
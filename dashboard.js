const API_BASE = 'http://localhost:3000/api';
let currentUser = null;

// Check authentication on page load
document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    
    if (!token || !user) {
        window.location.href = 'login.html';
        return;
    }
    
    currentUser = JSON.parse(user);
    
    // Verify token is still valid
    try {
        const response = await fetch(`${API_BASE}/me`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Token invalid');
        }
    } catch (error) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = 'login.html';
        return;
    }
    
    initializeDashboard();
});

function initializeDashboard() {
    // Update user info
    document.getElementById('userInfo').textContent = `${currentUser.name} (${currentUser.role})`;
    
    // Setup sidebar navigation
    setupNavigation();
    
    // Load default content
    loadDashboardHome();
}

function setupNavigation() {
    const sidebar = document.getElementById('sidebarNav');
    let navItems = [];
    
    // Common navigation items
    navItems.push({
        id: 'dashboard',
        icon: 'fas fa-tachometer-alt',
        text: 'Dashboard',
        onclick: 'loadDashboardHome()'
    });
    
    if (currentUser.role === 'student') {
        navItems.push(
            {
                id: 'attendance',
                icon: 'fas fa-calendar-check',
                text: 'Presensi',
                onclick: 'loadAttendanceForm()'
            },
            {
                id: 'materials',
                icon: 'fas fa-book',
                text: 'Materi',
                onclick: 'loadMaterials()'
            },
            {
                id: 'my-attendance',
                icon: 'fas fa-history',
                text: 'Riwayat Presensi',
                onclick: 'loadMyAttendance()'
            }
        );
    } else {
        navItems.push(
            {
                id: 'students',
                icon: 'fas fa-users',
                text: 'Data Siswa',
                onclick: 'loadStudents()'
            },
            {
                id: 'attendance-report',
                icon: 'fas fa-chart-bar',
                text: 'Laporan Presensi',
                onclick: 'loadAttendanceReport()'
            },
            {
                id: 'materials',
                icon: 'fas fa-book',
                text: 'Materi',
                onclick: 'loadMaterials()'
            },
            {
                id: 'upload-material',
                icon: 'fas fa-upload',
                text: 'Upload Materi',
                onclick: 'loadUploadMaterial()'
            }
        );
    }
    
    sidebar.innerHTML = navItems.map(item => `
        <a class="nav-link" href="#" id="nav-${item.id}" onclick="${item.onclick}">
            <i class="${item.icon}"></i>${item.text}
        </a>
    `).join('');
}

function setActiveNav(activeId) {
    document.querySelectorAll('.sidebar .nav-link').forEach(link => {
        link.classList.remove('active');
    });
    document.getElementById(`nav-${activeId}`).classList.add('active');
}

async function loadDashboardHome() {
    setActiveNav('dashboard');
    
    let content = `
        <h2><i class="fas fa-tachometer-alt mr-2"></i>Dashboard</h2>
        <div class="row">
    `;
    
    if (currentUser.role === 'student') {
        // Check today's attendance
        const attendanceToday = await checkTodayAttendance();
        
        content += `
            <div class="col-md-6">
                <div class="stat-card">
                    <h3><i class="fas fa-user"></i></h3>
                    <p class="mb-0">Selamat datang, ${currentUser.name}</p>
                    <small>Kelas: ${currentUser.class || 'Tidak diset'}</small>
                </div>
            </div>
            <div class="col-md-6">
                <div class="stat-card">
                    <h3><i class="fas fa-calendar-check"></i></h3>
                    <p class="mb-0">Presensi Hari Ini</p>
                    <small>${attendanceToday ? 'Sudah Presensi' : 'Belum Presensi'}</small>
                </div>
            </div>
        `;
    } else {
        // Load statistics for teachers/admin
        const stats = await loadStatistics();
        
        content += `
            <div class="col-md-4">
                <div class="stat-card">
                    <h3>${stats.totalStudents}</h3>
                    <p class="mb-0">Total Siswa</p>
                </div>
            </div>
            <div class="col-md-4">
                <div class="stat-card">
                    <h3>${stats.totalMaterials}</h3>
                    <p class="mb-0">Total Materi</p>
                </div>
            </div>
            <div class="col-md-4">
                <div class="stat-card">
                    <h3>${stats.todayAttendance}</h3>
                    <p class="mb-0">Presensi Hari Ini</p>
                </div>
            </div>
        `;
    }
    
    content += `
        </div>
        <div class="card">
            <div class="card-header">
                <h5 class="mb-0"><i class="fas fa-info-circle mr-2"></i>Informasi</h5>
            </div>
            <div class="card-body">
                <p>Selamat datang di Sistem Pembelajaran Online SD Muhammadiyah Denpasar.</p>
                ${currentUser.role === 'student' ? 
                    '<p>Gunakan menu di sebelah kiri untuk mengakses fitur presensi dan materi pembelajaran.</p>' :
                    '<p>Gunakan menu di sebelah kiri untuk mengelola siswa, presensi, dan materi pembelajaran.</p>'
                }
            </div>
        </div>
    `;
    
    document.getElementById('content').innerHTML = content;
}

async function checkTodayAttendance() {
    try {
        const response = await fetch(`${API_BASE}/attendance/today`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        const data = await response.json();
        return data.hasAttendance;
    } catch (error) {
        return false;
    }
}

async function loadStatistics() {
    try {
        const [studentsRes, materialsRes, attendanceRes] = await Promise.all([
            fetch(`${API_BASE}/students`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            }),
            fetch(`${API_BASE}/materials`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            }),
            fetch(`${API_BASE}/attendance`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            })
        ]);
        
        const students = await studentsRes.json();
        const materials = await materialsRes.json();
        const attendance = await attendanceRes.json();
        
        const today = new Date().toISOString().split('T')[0];
        const todayAttendance = attendance.filter(a => a.date === today).length;
        
        return {
            totalStudents: students.length,
            totalMaterials: materials.length,
            todayAttendance
        };
    } catch (error) {
        return { totalStudents: 0, totalMaterials: 0, todayAttendance: 0 };
    }
}

async function loadAttendanceForm() {
    setActiveNav('attendance');
    
    const attendanceToday = await checkTodayAttendance();
    
    let content = `
        <h2><i class="fas fa-calendar-check mr-2"></i>Presensi Harian</h2>
    `;
    
    if (attendanceToday) {
        content += `
            <div class="alert alert-success">
                <i class="fas fa-check-circle mr-2"></i>
                Anda sudah melakukan presensi hari ini.
            </div>
        `;
    } else {
        content += `
            <div class="attendance-form">
                <h4>Formulir Presensi</h4>
                <p>Silakan lakukan presensi harian Anda.</p>
                
                <form id="attendanceForm">
                    <div class="form-group">
                        <label>Status Kehadiran</label>
                        <select class="form-control" id="attendanceStatus" required>
                            <option value="present">Hadir</option>
                            <option value="late">Terlambat</option>
                            <option value="absent">Tidak Hadir</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label>Catatan (Opsional)</label>
                        <textarea class="form-control" id="attendanceNotes" rows="3" 
                                placeholder="Tambahkan catatan jika diperlukan..."></textarea>
                    </div>
                    
                    <button type="submit" class="btn btn-primary">
                        <i class="fas fa-check mr-2"></i>Submit Presensi
                    </button>
                </form>
            </div>
        `;
    }
    
    document.getElementById('content').innerHTML = content;
    
    if (!attendanceToday) {
        document.getElementById('attendanceForm').addEventListener('submit', submitAttendance);
    }
}

async function submitAttendance(e) {
    e.preventDefault();
    
    const status = document.getElementById('attendanceStatus').value;
    const notes = document.getElementById('attendanceNotes').value;
    
    try {
        const response = await fetch(`${API_BASE}/attendance`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ status, notes })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            alert('Presensi berhasil disimpan!');
            loadAttendanceForm(); // Reload to show success message
        } else {
            alert(data.error || 'Gagal menyimpan presensi');
        }
    } catch (error) {
        alert('Terjadi kesalahan saat menyimpan presensi');
    }
}

async function loadMaterials() {
    setActiveNav('materials');
    
    try {
        const response = await fetch(`${API_BASE}/materials`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        const materials = await response.json();
        
        let content = `
            <h2><i class="fas fa-book mr-2"></i>Materi Pembelajaran</h2>
            <div class="card">
                <div class="card-header">
                    <h5 class="mb-0">Daftar Materi</h5>
                </div>
                <div class="card-body">
        `;
        
        if (materials.length === 0) {
            content += '<p class="text-muted">Belum ada materi yang tersedia.</p>';
        } else {
            content += `
                <div class="table-responsive">
                    <table class="table table-hover">
                        <thead>
                            <tr>
                                <th>Judul</th>
                                <th>Mata Pelajaran</th>
                                <th>Kelas</th>
                                <th>Diunggah Oleh</th>
                                <th>Tanggal</th>
                                <th>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            
            materials.forEach(material => {
                const date = new Date(material.created_at).toLocaleDateString('id-ID');
                content += `
                    <tr>
                        <td>
                            <strong>${material.title}</strong>
                            ${material.description ? `<br><small class="text-muted">${material.description}</small>` : ''}
                        </td>
                        <td>${material.subject || '-'}</td>
                        <td>${material.class || '-'}</td>
                        <td>${material.uploaded_by_name}</td>
                        <td>${date}</td>
                        <td>
                            ${material.file_path ? 
                                `<a href="http://localhost:3000/${material.file_path}" target="_blank" class="btn btn-sm btn-primary">
                                    <i class="fas fa-download mr-1"></i>Download
                                </a>` : 
                                '<span class="text-muted">No file</span>'
                            }
                            ${currentUser.role !== 'student' ? 
                                `<button class="btn btn-sm btn-danger ml-1" onclick="deleteMaterial(${material.id})">
                                    <i class="fas fa-trash"></i>
                                </button>` : ''
                            }
                        </td>
                    </tr>
                `;
            });
            
            content += '</tbody></table></div>';
        }
        
        content += '</div></div>';
        
        document.getElementById('content').innerHTML = content;
        
    } catch (error) {
        document.getElementById('content').innerHTML = `
            <h2><i class="fas fa-book mr-2"></i>Materi Pembelajaran</h2>
            <div class="alert alert-danger">Gagal memuat materi pembelajaran.</div>
        `;
    }
}

async function loadUploadMaterial() {
    setActiveNav('upload-material');
    
    const content = `
        <h2><i class="fas fa-upload mr-2"></i>Upload Materi</h2>
        <div class="card">
            <div class="card-header">
                <h5 class="mb-0">Form Upload Materi</h5>
            </div>
            <div class="card-body">
                <form id="uploadForm" enctype="multipart/form-data">
                    <div class="form-group">
                        <label>Judul Materi *</label>
                        <input type="text" class="form-control" id="materialTitle" required>
                    </div>
                    
                    <div class="form-group">
                        <label>Deskripsi</label>
                        <textarea class="form-control" id="materialDescription" rows="3"></textarea>
                    </div>
                    
                    <div class="row">
                        <div class="col-md-6">
                            <div class="form-group">
                                <label>Mata Pelajaran</label>
                                <select class="form-control" id="materialSubject">
                                    <option value="">Pilih Mata Pelajaran</option>
                                    <option value="Matematika">Matematika</option>
                                    <option value="Bahasa Indonesia">Bahasa Indonesia</option>
                                    <option value="IPA">IPA</option>
                                    <option value="IPS">IPS</option>
                                    <option value="Bahasa Inggris">Bahasa Inggris</option>
                                    <option value="Agama Islam">Agama Islam</option>
                                    <option value="PJOK">PJOK</option>
                                    <option value="Seni Budaya">Seni Budaya</option>
                                </select>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="form-group">
                                <label>Kelas</label>
                                <select class="form-control" id="materialClass">
                                    <option value="">Pilih Kelas</option>
                                    <option value="Kelas 1">Kelas 1</option>
                                    <option value="Kelas 2">Kelas 2</option>
                                    <option value="Kelas 3">Kelas 3</option>
                                    <option value="Kelas 4">Kelas 4</option>
                                    <option value="Kelas 5">Kelas 5</option>
                                    <option value="Kelas 6">Kelas 6</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label>File Materi</label>
                        <div class="upload-area" id="uploadArea">
                            <i class="fas fa-cloud-upload-alt fa-3x text-muted mb-3"></i>
                            <p>Drag & drop file di sini atau klik untuk memilih</p>
                            <small class="text-muted">Mendukung: PDF, DOC, DOCX, PPT, PPTX, JPG, PNG, MP4, AVI, MOV (Max: 50MB)</small>
                            <input type="file" id="materialFile" class="d-none" accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.mp4,.avi,.mov">
                        </div>
                        <div id="fileInfo" class="mt-2"></div>
                    </div>
                    
                    <button type="submit" class="btn btn-primary">
                        <i class="fas fa-upload mr-2"></i>Upload Materi
                    </button>
                </form>
            </div>
        </div>
    `;
    
    document.getElementById('content').innerHTML = content;
    
    // Setup file upload
    setupFileUpload();
    
    document.getElementById('uploadForm').addEventListener('submit', uploadMaterial);
}

function setupFileUpload() {
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('materialFile');
    const fileInfo = document.getElementById('fileInfo');
    
    uploadArea.addEventListener('click', () => fileInput.click());
    
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });
    
    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });
    
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            fileInput.files = files;
            showFileInfo(files[0]);
        }
    });
    
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            showFileInfo(e.target.files[0]);
        }
    });
    
    function showFileInfo(file) {
        const size = (file.size / 1024 / 1024).toFixed(2);
        fileInfo.innerHTML = `
            <div class="alert alert-info">
                <i class="fas fa-file mr-2"></i>
                <strong>${file.name}</strong> (${size} MB)
            </div>
        `;
    }
}

async function uploadMaterial(e) {
    e.preventDefault();
    
    const formData = new FormData();
    formData.append('title', document.getElementById('materialTitle').value);
    formData.append('description', document.getElementById('materialDescription').value);
    formData.append('subject', document.getElementById('materialSubject').value);
    formData.append('class', document.getElementById('materialClass').value);
    
    const fileInput = document.getElementById('materialFile');
    if (fileInput.files[0]) {
        formData.append('file', fileInput.files[0]);
    }
    
    try {
        const response = await fetch(`${API_BASE}/materials`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: formData
        });
        
        const data = await response.json();
        
        if (response.ok) {
            alert('Materi berhasil diupload!');
            loadMaterials(); // Redirect to materials list
        } else {
            alert(data.error || 'Gagal mengupload materi');
        }
    } catch (error) {
        alert('Terjadi kesalahan saat mengupload materi');
    }
}

async function deleteMaterial(id) {
    if (!confirm('Apakah Anda yakin ingin menghapus materi ini?')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/materials/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (response.ok) {
            alert('Materi berhasil dihapus!');
            loadMaterials(); // Reload materials list
        } else {
            const data = await response.json();
            alert(data.error || 'Gagal menghapus materi');
        }
    } catch (error) {
        alert('Terjadi kesalahan saat menghapus materi');
    }
}

async function loadMyAttendance() {
    setActiveNav('my-attendance');
    
    try {
        const response = await fetch(`${API_BASE}/attendance`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        const attendance = await response.json();
        
        let content = `
            <h2><i class="fas fa-history mr-2"></i>Riwayat Presensi</h2>
            <div class="card">
                <div class="card-header">
                    <h5 class="mb-0">Riwayat Presensi Anda</h5>
                </div>
                <div class="card-body">
        `;
        
        if (attendance.length === 0) {
            content += '<p class="text-muted">Belum ada riwayat presensi.</p>';
        } else {
            content += `
                <div class="table-responsive">
                    <table class="table table-hover">
                        <thead>
                            <tr>
                                <th>Tanggal</th>
                                <th>Status</th>
                                <th>Catatan</th>
                                <th>Waktu Input</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            
            attendance.forEach(record => {
                const date = new Date(record.date).toLocaleDateString('id-ID');
                const time = new Date(record.created_at).toLocaleString('id-ID');
                
                let statusBadge = '';
                switch (record.status) {
                    case 'present':
                        statusBadge = '<span class="badge badge-success">Hadir</span>';
                        break;
                    case 'late':
                        statusBadge = '<span class="badge badge-warning">Terlambat</span>';
                        break;
                    case 'absent':
                        statusBadge = '<span class="badge badge-danger">Tidak Hadir</span>';
                        break;
                }
                
                content += `
                    <tr>
                        <td>${date}</td>
                        <td>${statusBadge}</td>
                        <td>${record.notes || '-'}</td>
                        <td>${time}</td>
                    </tr>
                `;
            });
            
            content += '</tbody></table></div>';
        }
        
        content += '</div></div>';
        
        document.getElementById('content').innerHTML = content;
        
    } catch (error) {
        document.getElementById('content').innerHTML = `
            <h2><i class="fas fa-history mr-2"></i>Riwayat Presensi</h2>
            <div class="alert alert-danger">Gagal memuat riwayat presensi.</div>
        `;
    }
}

async function loadStudents() {
    setActiveNav('students');
    
    try {
        const response = await fetch(`${API_BASE}/students`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        const students = await response.json();
        
        let content = `
            <h2><i class="fas fa-users mr-2"></i>Data Siswa</h2>
            <div class="card">
                <div class="card-header">
                    <h5 class="mb-0">Daftar Siswa</h5>
                </div>
                <div class="card-body">
        `;
        
        if (students.length === 0) {
            content += '<p class="text-muted">Belum ada data siswa.</p>';
        } else {
            content += `
                <div class="table-responsive">
                    <table class="table table-hover">
                        <thead>
                            <tr>
                                <th>Username</th>
                                <th>Nama</th>
                                <th>Kelas</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            
            students.forEach(student => {
                content += `
                    <tr>
                        <td>${student.username}</td>
                        <td>${student.name}</td>
                        <td>${student.class || '-'}</td>
                    </tr>
                `;
            });
            
            content += '</tbody></table></div>';
        }
        
        content += '</div></div>';
        
        document.getElementById('content').innerHTML = content;
        
    } catch (error) {
        document.getElementById('content').innerHTML = `
            <h2><i class="fas fa-users mr-2"></i>Data Siswa</h2>
            <div class="alert alert-danger">Gagal memuat data siswa.</div>
        `;
    }
}

async function loadAttendanceReport() {
    setActiveNav('attendance-report');
    
    try {
        const response = await fetch(`${API_BASE}/attendance`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        const attendance = await response.json();
        
        let content = `
            <h2><i class="fas fa-chart-bar mr-2"></i>Laporan Presensi</h2>
            <div class="card">
                <div class="card-header">
                    <h5 class="mb-0">Laporan Presensi Siswa</h5>
                </div>
                <div class="card-body">
        `;
        
        if (attendance.length === 0) {
            content += '<p class="text-muted">Belum ada data presensi.</p>';
        } else {
            content += `
                <div class="table-responsive">
                    <table class="table table-hover">
                        <thead>
                            <tr>
                                <th>Tanggal</th>
                                <th>Nama Siswa</th>
                                <th>Kelas</th>
                                <th>Status</th>
                                <th>Catatan</th>
                                <th>Waktu Input</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            
            attendance.forEach(record => {
                const date = new Date(record.date).toLocaleDateString('id-ID');
                const time = new Date(record.created_at).toLocaleString('id-ID');
                
                let statusBadge = '';
                switch (record.status) {
                    case 'present':
                        statusBadge = '<span class="badge badge-success">Hadir</span>';
                        break;
                    case 'late':
                        statusBadge = '<span class="badge badge-warning">Terlambat</span>';
                        break;
                    case 'absent':
                        statusBadge = '<span class="badge badge-danger">Tidak Hadir</span>';
                        break;
                }
                
                content += `
                    <tr>
                        <td>${date}</td>
                        <td>${record.student_name}</td>
                        <td>${record.class || '-'}</td>
                        <td>${statusBadge}</td>
                        <td>${record.notes || '-'}</td>
                        <td>${time}</td>
                    </tr>
                `;
            });
            
            content += '</tbody></table></div>';
        }
        
        content += '</div></div>';
        
        document.getElementById('content').innerHTML = content;
        
    } catch (error) {
        document.getElementById('content').innerHTML = `
            <h2><i class="fas fa-chart-bar mr-2"></i>Laporan Presensi</h2>
            <div class="alert alert-danger">Gagal memuat laporan presensi.</div>
        `;
    }
}

function logout() {
    if (confirm('Apakah Anda yakin ingin logout?')) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = 'login.html';
    }
}
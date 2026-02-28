import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  Divider,
  IconButton,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Avatar,
  Menu,
  MenuItem,
  Collapse,
  Tooltip,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  PieChart,
  AccountBalance,
  Settings,
  Logout,
  ExpandLess,
  ExpandMore,
  Email,
  TrendingUp,
  Business,
  Category,
  Assessment,
  AccountTree,
  Work,
  ChevronLeft,
  ChevronRight,
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import MyLogo from '../assets/lion.png';

const drawerWidth = 210;
const collapsedDrawerWidth = 60;

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, isAdmin, isViewer } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [adminOpen, setAdminOpen] = useState(false);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleDrawerCollapse = () => {
    setDrawerOpen(!drawerOpen);
    // Close admin submenu when collapsing
    if (drawerOpen) {
      setAdminOpen(false);
    }
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    logout();
    navigate('/');
    handleMenuClose();
  };

  const handleAdminToggle = () => {
    setAdminOpen(!adminOpen);
  };

  // Build menu items based on user role
  const menuItems = [];

  menuItems.push({ text: 'Stocks', icon: <TrendingUp />, path: '/list-stocks' });
  menuItems.push({ text: 'ETFs', icon: <PieChart />, path: '/list-etfs' });

  if (isViewer || isAdmin) {
    menuItems.push({ text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' });
  }

  // Admin submenu items
  const adminMenuItems = [
    { text: 'Allowed Emails', icon: <Email />, path: '/admin/allowed-emails' },
    { text: 'Industries', icon: <Category />, path: '/admin/industries' },
    { text: 'Stocks', icon: <TrendingUp />, path: '/admin/stocks' },
    { text: 'ETFs', icon: <PieChart />, path: '/admin/etfs' },
    { text: 'Bonds', icon: <AccountBalance />, path: '/admin/bonds' },
    { text: 'Mutual Funds', icon: <Business />, path: '/admin/mutual-funds' },
    { text: 'Strategies', icon: <AccountTree />, path: '/admin/strategies' },
    { text: 'Scheduler', icon: <Settings />, path: '/admin/scheduler' },
    { text: 'Audit Logs', icon: <Assessment />, path: '/admin/audit-logs' },
  ];

  // Holdings sub-pages for active path detection
  const holdingsPaths = ['/holding-accounts', '/list-holdings', '/upload-holdings'];
  const isHoldingsActive = holdingsPaths.some((p) => location.pathname.startsWith(p));

  const currentDrawerWidth = drawerOpen ? drawerWidth : collapsedDrawerWidth;

  const drawer = (
    <div>
      <Toolbar
        sx={{
          display: 'flex',
          flexDirection: drawerOpen ? 'row' : 'column',
          justifyContent: drawerOpen ? 'space-between' : 'center',
          alignItems: 'center',
          gap: drawerOpen ? 0 : 1,
          py: drawerOpen ? 0 : 1,
        }}
      >
        <Box display="flex" alignItems="center" gap={1}>
          <Box
            component="img"
            sx={{ height: drawerOpen ? 28 : 24, width: 'auto', transition: 'height 0.2s ease' }}
            alt="Company Logo"
            src={MyLogo}
          />
          {drawerOpen && (
            <Typography variant="subtitle1" noWrap component="div" sx={{ color: '#667eea', fontWeight: 700 }}>
              Leowit Portfolio
            </Typography>
          )}
        </Box>
        <IconButton onClick={handleDrawerCollapse} size="small">
          {drawerOpen ? <ChevronLeft /> : <ChevronRight />}
        </IconButton>
      </Toolbar>
      <Divider />
      <List>
        {menuItems.map((item) => (
          <ListItem key={item.text} disablePadding>
            <Tooltip title={!drawerOpen ? item.text : ''} placement="right">
              <ListItemButton
                selected={location.pathname === item.path}
                onClick={() => navigate(item.path)}
                sx={{ justifyContent: drawerOpen ? 'initial' : 'center' }}
              >
                <ListItemIcon sx={{ minWidth: drawerOpen ? 56 : 0, justifyContent: 'center' }}>
                  {item.icon}
                </ListItemIcon>
                {drawerOpen && <ListItemText primary={item.text} />}
              </ListItemButton>
            </Tooltip>
          </ListItem>
        ))}

        {/* Holdings – direct link, no submenu */}
        {(isViewer || isAdmin) && (
          <ListItem disablePadding>
            <Tooltip title={!drawerOpen ? 'Holdings' : ''} placement="right">
              <ListItemButton
                selected={isHoldingsActive}
                onClick={() => navigate('/holding-accounts')}
                sx={{ justifyContent: drawerOpen ? 'initial' : 'center' }}
              >
                <ListItemIcon sx={{ minWidth: drawerOpen ? 56 : 0, justifyContent: 'center' }}>
                  <Work />
                </ListItemIcon>
                {drawerOpen && <ListItemText primary="Holdings" />}
              </ListItemButton>
            </Tooltip>
          </ListItem>
        )}

        {/* Admin Menu */}
        {isAdmin && (
          <>
            <ListItem disablePadding>
              <Tooltip title={!drawerOpen ? 'Admin' : ''} placement="right">
                <ListItemButton 
                  onClick={drawerOpen ? handleAdminToggle : undefined}
                  sx={{ justifyContent: drawerOpen ? 'initial' : 'center' }}
                >
                  <ListItemIcon sx={{ minWidth: drawerOpen ? 56 : 0, justifyContent: 'center' }}>
                    <Settings />
                  </ListItemIcon>
                  {drawerOpen && (
                    <>
                      <ListItemText primary="Admin" />
                      {adminOpen ? <ExpandLess /> : <ExpandMore />}
                    </>
                  )}
                </ListItemButton>
              </Tooltip>
            </ListItem>
            {drawerOpen && (
              <Collapse in={adminOpen} timeout="auto" unmountOnExit>
                <List component="div" disablePadding>
                  {adminMenuItems.map((item) => (
                    <ListItem key={item.text} disablePadding>
                      <ListItemButton
                        sx={{
                          pl: 4,
                          backgroundColor: 'action.hover',
                          '&:hover': { backgroundColor: 'action.selected' },
                          '&.Mui-selected': {
                            backgroundColor: 'primary.light',
                            '&:hover': { backgroundColor: 'primary.light' },
                          },
                        }}
                        selected={location.pathname === item.path}
                        onClick={() => navigate(item.path)}
                      >
                        <ListItemIcon sx={{ color: 'primary.main' }}>{item.icon}</ListItemIcon>
                        <ListItemText
                          primary={item.text}
                          primaryTypographyProps={{ fontSize: '0.9rem', color: 'text.secondary' }}
                        />
                      </ListItemButton>
                    </ListItem>
                  ))}
                </List>
              </Collapse>
            )}
          </>
        )}
      </List>
    </div>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${currentDrawerWidth}px)` },
          ml: { sm: `${currentDrawerWidth}px` },
          transition: 'width 0.2s, margin 0.2s',
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 1, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Box sx={{ flexGrow: 1 }} />
          <IconButton onClick={handleMenuOpen} sx={{ p: 0 }}>
            <Avatar sx={{ bgcolor: 'secondary.main' }}>
              {user?.name?.charAt(0) || user?.email?.charAt(0) || 'U'}
            </Avatar>
          </IconButton>
          <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}>
            <MenuItem disabled>
              <Typography variant="body2">{user?.email}</Typography>
            </MenuItem>
            <Divider />
            <MenuItem onClick={handleLogout}>
              <ListItemIcon>
                <Logout fontSize="small" />
              </ListItemIcon>
              Logout
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>
      <Box component="nav" sx={{ width: { sm: currentDrawerWidth }, flexShrink: { sm: 0 } }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': { 
              boxSizing: 'border-box', 
              width: currentDrawerWidth,
              transition: 'width 0.2s',
              overflowX: 'hidden',
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 1,
          width: { sm: `calc(100% - ${currentDrawerWidth}px)` },
          transition: 'width 0.2s',
        }}
      >
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
};

export default Layout;
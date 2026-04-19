import Navbar from "./Navbar";

const Layout = ({ children }) => {
  return (
    <div className="min-h-screen w-full flex flex-col bg-slate-950 text-slate-100">

      {/* Navbar */}
      <Navbar />

      {/* Page Content */}
      <main className="flex-1 w-full">
        <div className="max-w-6xl mx-auto w-full px-4 py-6">
          {children}
        </div>
      </main>

    </div>
  );
};

export default Layout;
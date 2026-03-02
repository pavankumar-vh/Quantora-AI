import Sidebar from '@/components/Sidebar';

export default function SidebarLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex h-screen overflow-hidden bg-[var(--bg)]">
            <Sidebar />
            <div className="flex-1 flex flex-col overflow-hidden">
                {children}
            </div>
        </div>
    );
}

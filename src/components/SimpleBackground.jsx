const SimpleBackground = () => {
    return (
        <div className="fixed inset-0 -z-10 overflow-hidden bg-white">
            {/* Top Left subtle pink orb */}
            <div
                className="absolute top-0 left-0 -translate-x-[20%] -translate-y-[20%] w-[800px] h-[800px] rounded-full opacity-20 blur-3xl"
                style={{
                    background: 'radial-gradient(circle, #E413A2 0%, rgba(255,255,255,0) 70%)',
                }}
            ></div>

            {/* Bottom Right subtle secondary orb (soft violet/blue for depth) */}
            <div
                className="absolute bottom-0 right-0 translate-x-[20%] translate-y-[20%] w-[800px] h-[800px] rounded-full opacity-15 blur-3xl"
                style={{
                    background: 'radial-gradient(circle, #8B5CF6 0%, rgba(255,255,255,0) 70%)',
                }}
            ></div>

            {/* Optional: A very faint subtle noise texture overlay could be added here for extra premium feel, but let's stick to gradient first */}
        </div>
    );
};

export default SimpleBackground;

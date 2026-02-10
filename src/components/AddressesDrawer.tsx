<ProfileDrawer
  isOpen={isProfileOpen}
  onClose={() => setIsProfileOpen(false)}
  user={user}
/>

<AddressesDrawer
  isOpen={isAddressesOpen}
  onClose={() => setIsAddressesOpen(false)}
  onSelect={(addr) => {
    // если хочешь выбирать адрес как текущий
    setCurrentAddressLabel(addr.title);
    setIsAddressesOpen(false);
  }}
/>

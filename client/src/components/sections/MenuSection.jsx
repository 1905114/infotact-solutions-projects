import MenuItemCard from "../features/MenuItemCard";

const menu = [
  {
    category: "Burgers",
    items: [
      { name: "Cheese Burger", price: 149 },
      { name: "Double Patty Burger", price: 199 }
    ]
  },
  {
    category: "Drinks",
    items: [
      { name: "Coke", price: 49 },
      { name: "Cold Coffee", price: 99 }
    ]
  }
];

const MenuSection = () => {
  return (
    <div className="space-y-10">

      {menu.map((section, idx) => (
        <div key={idx}>

          {/* CATEGORY TITLE */}
          <h2 className="text-xl font-semibold mb-4">
            {section.category}
          </h2>

          {/* ITEMS */}
          <div className="space-y-4">
            {section.items.map((item, i) => (
              <MenuItemCard key={i} item={item} />
            ))}
          </div>

        </div>
      ))}

    </div>
  );
};

export default MenuSection;
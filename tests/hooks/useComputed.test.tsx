import ko, { isSubscribable } from "knockout";
import React, { useState } from "react";
import { act } from "react-dom/test-utils";
import useComputed from "../../src/hooks/useComputed";
import useObservable from "../../src/hooks/useObservable";
import { mount } from "../enzyme";

test("nested observables", () => {
    const data = {
        persons: [
            {
                name: ko.observable("Bob"),
                age: ko.observable(30),
            },
        ]
    };

    let forceUpdateCount = 0;
    let computedCount = 0;
    let renderCount = 0;

    const subscribablePersons = data.persons.flatMap(person => Object.values(person).filter(isSubscribable));

    const ArrayUI = () => {
        renderCount++;

        const forceUpdate = useComputed(() => {
            forceUpdateCount++;
            subscribablePersons.forEach(x => x());
            const rn = Math.random();
            console.log("force update " + rn);

            return rn;
        })

        const sum = useComputed(() => {
            computedCount++;

            return data
                .persons
                .map(x => x.age())
                .reduce((a, b) => a + b, 0);
        }, [forceUpdate]);

        return <div>{sum}</div>;
    };

    const element = mount(<ArrayUI />);

    expect(element.text()).toBe("30");

    expect(computedCount).toBe(1);
    expect(renderCount).toBe(1);
    expect(forceUpdateCount).toBe(1);

    act(() => {
        data.persons[0].age(31);
    });

    expect(element.text()).toBe("31");

    expect(computedCount).toBe(2); // 3
    expect(renderCount).toBe(2);
    expect(forceUpdateCount).toBe(2);
});

// test("doesn't need a deps array to update", () => {
//     class Person {
//         public firstName: KnockoutObservable<string>;
//         public lastName: KnockoutObservable<string>;

//         constructor(firstName: string, lastName: string) {
//             this.firstName = ko.observable(firstName);
//             this.lastName = ko.observable(lastName);
//         }
//     }

//     class Persons {
//         persons: Person[] = [
//             new Person("Bob", "Ross"),
//             new Person("Fred", "Perry"),
//         ];

//         shouldBeIgnored = "ignored";

//         unrelated = ko.observable(Math.random());
//     }

//     const persons = new Persons();

//     const deps = persons.persons.flatMap(person => Object.values(person).filter(isSubscribable));

//     // 2 people, 2 names each
//     expect(deps.length).toBe(4);

//     let computedCount = 0;

//     const PersonsUI = () => {
//         const names = useComputed(() => {
//             computedCount++;

//             return persons.persons;
//         }, [deps]);

//         return <div>{name}</div>;
//     };

//     const element = mount(<PersonsUI />);

//     expect(element.text()).toBe("bob rossfred perry 1");
// });

test("doesn't need a deps array to update", () => {
    const firstName = ko.observable("bob");
    const lastName = ko.observable("ross");
    const unrelated = ko.observable(Math.random());

    let computedCount = 0;

    const Name = () => {
        const unrelatedValue = useObservable(unrelated);

        const name = useComputed(() => {
            computedCount++;
            return firstName() + ' ' + lastName() + ' ' + computedCount;
        }, [unrelatedValue]);

        return <div>{name}</div>;
    };

    const element = mount(<Name />);

    expect(computedCount).toBe(1);
    expect(element.text()).toBe("bob ross 1");

    firstName("fred");

    expect(computedCount).toBe(2);
    expect(element.text()).toBe("fred ross 2");

    lastName("perry");


    expect(computedCount).toBe(3);
    expect(element.text()).toBe("fred perry 3");

    unrelated(Math.random());

    expect(computedCount).toBe(4);
    expect(element.text()).toBe("fred perry 4");
});

test("can compute JSX based on observables", () => {
    interface ComponentProps {
        firstName: KnockoutObservable<string>;
        lastName: KnockoutObservable<string>;
    }
    const Component = ({ firstName, lastName }: ComponentProps) =>
        useComputed(
            () => (
                <div>
                    {firstName()} {lastName()}
                </div>
            ),
        );
    const firstName = ko.observable("Bob");
    const lastName = ko.observable("Ross");
    const element = mount(
        <Component firstName={firstName} lastName={lastName} />,
    );
    expect(element.text()).toBe("Bob Ross");
    act(() => {
        lastName("Jones");
    });
    expect(element.text()).toBe("Bob Jones");
});

test("doesn't call the render or computed function unnecessarily", () => {
    interface ComponentProps {
        c: KnockoutObservable<number>;
    }
    let renderCount = 0;
    let computedCount = 0;
    const Component = ({ c }: ComponentProps) => {
        renderCount++;
        return useComputed(() => {
            computedCount++;
            return <div>{c()}</div>;
        });
    };
    const count = ko.observable(0);
    mount(<Component c={count} />);
    expect(renderCount).toBe(1);
    expect(computedCount).toBe(1);
    act(() => {
        count(count() + 1);
    });
    expect(renderCount).toBe(2);
    expect(computedCount).toBe(2);
});

test("can be used with closure values", () => {
    const Counter = () => {
        const [count, setCount] = useState(0);

        return useComputed(() => (
            <div onClick={() => setCount(count + 1)}>Value is {count}</div>
        ), [count]);
    };
    const element = mount(<Counter />);
    act(() => {
        element.simulate("click");
    });
    expect(element.text()).toBe("Value is 1");
});

test("doesn't call the render or computed function unnecessarily with deps", () => {
    let renderCount = 0;
    let computedCount = 0;
    const Counter = ({ plus }: { plus: KnockoutObservable<number> }) => {
        renderCount++;
        const [count, setCount] = useState(0);
        return useComputed(
            () => (
                computedCount++,
                (
                    <div onClick={() => setCount(count + 1)}>
                        Value is {count + plus()}
                    </div>
                )
            ),
            [count],
        );
    };
    const plus = ko.observable(0);
    const element = mount(<Counter plus={plus} />);
    expect(renderCount).toBe(1);
    expect(computedCount).toBe(1);
    expect(element.text()).toBe("Value is 0");

    // Update observable state
    act(() => {
        plus(2);
    });
    expect(renderCount).toBe(2);
    expect(computedCount).toBe(2);
    expect(element.text()).toBe("Value is 2");

    // Update non-observable state
    act(() => {
        element.simulate("click");
    });
    expect(renderCount).toBe(3);
    expect(computedCount).toBe(3);
    expect(element.text()).toBe("Value is 3");
});
